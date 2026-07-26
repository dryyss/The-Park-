import "server-only";
import { prisma } from "@/lib/prisma";
import type { CardCondition } from "@/generated/prisma/client";
import { scheduleBadgeEvaluation } from "@/server/badge/badge.service";

/** Clé d'unicité d'un exemplaire possédé. */
function itemKey(userId: string, variantId: string, condition: CardCondition) {
  return { userId_variantId_condition: { userId, variantId, condition } };
}

/** Retrouve un exemplaire possédé. */
export async function findOwnedItem(userId: string, variantId: string, condition: CardCondition) {
  return prisma.collectionItem.findUnique({ where: itemKey(userId, variantId, condition) });
}

export async function addCollectionItem(
  userId: string,
  variantId: string,
  condition: CardCondition = "EXCELLENT",
  quantity = 1,
): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({ where: { id: variantId }, select: { id: true } });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");

  await prisma.collectionItem.upsert({
    where: itemKey(userId, variantId, condition),
    create: { userId, variantId, condition, quantity },
    update: { quantity: { increment: quantity } },
  });
  scheduleBadgeEvaluation(userId);
}

export async function removeCollectionItem(
  userId: string,
  variantId: string,
  condition: CardCondition = "EXCELLENT",
): Promise<void> {
  const item = await prisma.collectionItem.findUnique({
    where: itemKey(userId, variantId, condition),
    select: { id: true, reservedQuantity: true },
  });
  if (!item) throw new Error("NOT_FOUND");
  if (item.reservedQuantity > 0) throw new Error("RESERVED");

  await prisma.collectionItem.delete({ where: { id: item.id } });
  scheduleBadgeEvaluation(userId);
}

export async function updateCollectionQuantity(
  userId: string,
  variantId: string,
  quantity: number,
  condition: CardCondition = "EXCELLENT",
): Promise<void> {
  if (quantity <= 0) {
    await removeCollectionItem(userId, variantId, condition);
    return;
  }

  const item = await prisma.collectionItem.findUnique({
    where: itemKey(userId, variantId, condition),
    select: { reservedQuantity: true },
  });
  if (item && quantity < item.reservedQuantity) throw new Error("BELOW_RESERVED");

  await prisma.collectionItem.upsert({
    where: itemKey(userId, variantId, condition),
    create: { userId, variantId, condition, quantity },
    update: { quantity },
  });
  scheduleBadgeEvaluation(userId);
}

/** Client Prisma ou client de transaction — les transferts s'exécutent dans une tx. */
type PrismaLike = Pick<typeof prisma, "collectionItem">;

/**
 * Transfère des exemplaires d'un membre à un autre (vente conclue, échange validé).
 *
 * L'exemplaire cédé était réservé : on décrémente la ligne portant la réservation.
 */
export async function transferOwnedCopies(
  tx: PrismaLike,
  input: {
    fromUserId: string;
    toUserId: string;
    variantId: string;
    condition: CardCondition;
    quantity?: number;
  },
): Promise<void> {
  const { fromUserId, toUserId, variantId, condition } = input;
  const quantity = input.quantity ?? 1;

  const source = await tx.collectionItem.findFirst({
    where: { userId: fromUserId, variantId, condition, reservedQuantity: { gt: 0 } },
    select: { id: true },
  });
  // Repli : réservation déjà retombée (annulation, purge) — on prend la ligne
  // existante pour ne pas bloquer la conclusion de la transaction.
  const fallback = source
    ? null
    : await tx.collectionItem.findFirst({
        where: { userId: fromUserId, variantId, condition, quantity: { gt: 0 } },
        select: { id: true },
      });
  const from = source ?? fallback;

  if (from) {
    await tx.collectionItem.update({
      where: { id: from.id },
      data: {
        quantity: { decrement: quantity },
        ...(source ? { reservedQuantity: { decrement: quantity } } : {}),
      },
    });
  }

  await tx.collectionItem.upsert({
    where: { userId_variantId_condition: { userId: toUserId, variantId, condition } },
    create: { userId: toUserId, variantId, condition, quantity },
    update: { quantity: { increment: quantity } },
  });
}

const DEFAULT_CONDITION: CardCondition = "EXCELLENT";

/** Désigne une carte du catalogue : par identifiant si connu, sinon par numéro. */
export type CardRef = { cardId?: string | null; cardNumber: number };

/**
 * `number` n'est unique que par saison (`@@unique([seasonId, number])`) : chercher
 * une carte sur le seul numéro renvoyait une carte d'une autre saison, et l'ajout
 * partait sur la mauvaise ligne. On privilégie donc toujours l'identifiant.
 */
async function findCardForAdjust(ref: CardRef) {
  const include = { variants: { include: { versionType: true } } } as const;
  if (ref.cardId) {
    const byId = await prisma.card.findUnique({ where: { id: ref.cardId }, include });
    if (byId) return byId;
  }
  return prisma.card.findFirst({
    where: { number: ref.cardNumber },
    orderBy: [{ season: { code: "asc" } }],
    include,
  });
}

/**
 * +1 / −1 sur une carte du classeur (toutes versions confondues côté affichage).
 *
 * `setId` cible la déclinaison d'une collection précise : sur l'onglet d'une
 * collection, l'exemplaire ajouté doit atterrir sur SA variante, sinon la carte
 * reste affichée comme manquante après ajout.
 */
export async function adjustCollectionCardQuantity(
  userId: string,
  ref: CardRef,
  delta: 1 | -1,
  condition: CardCondition = DEFAULT_CONDITION,
  setId: string | null = null,
): Promise<void> {
  const card = await findCardForAdjust(ref);
  if (!card) throw new Error("CARD_NOT_FOUND");

  const inSet = setId ? card.variants.filter((v) => v.setId === setId) : card.variants;
  const pool = inSet.length > 0 ? inSet : card.variants;
  const standardVariants = pool.filter((v) => v.versionType.code === "standard");

  if (delta === 1) {
    const target = standardVariants[0] ?? pool[0];
    if (!target) throw new Error("VARIANT_NOT_FOUND");
    await addCollectionItem(userId, target.id, condition, 1);
    return;
  }

  const poolIds = new Set(pool.map((v) => v.id));
  const items = (
    await prisma.collectionItem.findMany({
      where: { userId, variant: { cardId: card.id }, quantity: { gt: 0 } },
      orderBy: [{ variant: { versionType: { sortOrder: "asc" } } }],
      select: { id: true, variantId: true, condition: true, quantity: true, reservedQuantity: true },
    })
  ).filter((i) => poolIds.has(i.variantId));

  if (items.length === 0) return;

  const standardVariantIds = new Set(standardVariants.map((v) => v.id));
  const target =
    items.find((i) => standardVariantIds.has(i.variantId) && i.condition === condition) ??
    items.find((i) => standardVariantIds.has(i.variantId) && i.condition === DEFAULT_CONDITION) ??
    items.find((i) => i.quantity > i.reservedQuantity) ??
    items[0];

  if (!target) throw new Error("RESERVED");

  const nextQty = target.quantity - 1;
  if (nextQty < target.reservedQuantity) throw new Error("BELOW_RESERVED");

  if (nextQty <= 0) {
    await removeCollectionItem(userId, target.variantId, target.condition);
  } else {
    await updateCollectionQuantity(userId, target.variantId, nextQty, target.condition);
  }
}

/** +1 / −1 sur une version précise (toutes conditions agrégées côté affichage). */
export async function adjustCollectionVariantQuantity(
  userId: string,
  variantId: string,
  delta: 1 | -1,
  condition: CardCondition = DEFAULT_CONDITION,
): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({ where: { id: variantId }, select: { id: true } });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");

  if (delta === 1) {
    await addCollectionItem(userId, variantId, condition, 1);
    return;
  }

  const items = await prisma.collectionItem.findMany({
    where: { userId, variantId, quantity: { gt: 0 } },
    orderBy: [{ condition: "asc" }],
    select: { id: true, condition: true, quantity: true, reservedQuantity: true },
  });

  if (items.length === 0) return;

  const target =
    items.find((i) => i.condition === condition && i.quantity > i.reservedQuantity) ??
    items.find((i) => i.condition === condition) ??
    items.find((i) => i.condition === DEFAULT_CONDITION && i.quantity > i.reservedQuantity) ??
    items.find((i) => i.quantity > i.reservedQuantity) ??
    items[0];

  if (!target) throw new Error("RESERVED");

  const nextQty = target.quantity - 1;
  if (nextQty < target.reservedQuantity) throw new Error("BELOW_RESERVED");

  if (nextQty <= 0) {
    await removeCollectionItem(userId, variantId, target.condition);
  } else {
    await updateCollectionQuantity(userId, variantId, nextQty, target.condition);
  }
}

/** Active ou désactive la gradation sur un exemplaire (par état). */
export async function updateCollectionGrading(
  userId: string,
  variantId: string,
  condition: CardCondition,
  input: {
    isGraded?: boolean;
    gradeCompany?: string | null;
    gradeScore?: number | null;
  },
): Promise<void> {
  const item = await findOwnedItem(userId, variantId, condition);
  if (!item) throw new Error("NOT_FOUND");

  if (input.isGraded === false) {
    await prisma.collectionItem.update({
      where: { id: item.id },
      data: { isGraded: false, gradeCompany: null, gradeScore: null },
    });
    return;
  }

  const nextGraded = input.isGraded ?? item.isGraded;
  await prisma.collectionItem.update({
    where: { id: item.id },
    data: {
      isGraded: nextGraded,
      ...(input.gradeCompany !== undefined ? { gradeCompany: input.gradeCompany } : {}),
      ...(input.gradeScore !== undefined ? { gradeScore: input.gradeScore } : {}),
      ...(nextGraded === false ? { gradeCompany: null, gradeScore: null } : {}),
    },
  });
}

/** Active ou désactive la signature sur un exemplaire (par état). */
export async function updateCollectionSignature(
  userId: string,
  variantId: string,
  condition: CardCondition,
  isSigned: boolean,
  signatureAuthor?: string | null,
): Promise<void> {
  const item = await findOwnedItem(userId, variantId, condition);
  if (!item) throw new Error("NOT_FOUND");

  const author = signatureAuthor?.trim() || null;

  await prisma.collectionItem.update({
    where: { id: item.id },
    data: isSigned
      ? { isSigned: true, signatureAuthor: author }
      : { isSigned: false, signatureAuthor: null },
  });
}
