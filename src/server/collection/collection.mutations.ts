import "server-only";
import { prisma } from "@/lib/prisma";
import type { CardCondition } from "@/generated/prisma/client";
import { scheduleBadgeEvaluation } from "@/server/badge/badge.service";
import {
  collectionEditionToPreset,
  editionPresetToLabel,
  effectiveEditionPreset,
  isFirstEditionLabel,
  type CollectionEdition,
  type EditionPresetCode,
} from "@/lib/card-edition";

export type { CollectionEdition };

const DEFAULT_EDITION_PRESET: EditionPresetCode = "unlimited";

/** Clé d'unicité d'un exemplaire possédé (l'édition en fait partie). */
function itemKey(
  userId: string,
  variantId: string,
  condition: CardCondition,
  editionPreset: EditionPresetCode,
) {
  return { userId_variantId_condition_editionPreset: { userId, variantId, condition, editionPreset } };
}

/**
 * Retrouve un exemplaire possédé.
 *
 * L'édition faisant partie de la clé, un même couple (variante, état) peut
 * désormais porter deux lignes. Sans preset explicite — cas des écrans qui
 * n'exposent pas encore le filtre d'édition — on retient la pile la plus fournie
 * plutôt que d'échouer sur une clé ambiguë.
 */
export async function findOwnedItem(
  userId: string,
  variantId: string,
  condition: CardCondition,
  editionPreset?: EditionPresetCode,
) {
  if (editionPreset) {
    return prisma.collectionItem.findUnique({ where: itemKey(userId, variantId, condition, editionPreset) });
  }
  return prisma.collectionItem.findFirst({
    where: { userId, variantId, condition },
    orderBy: [{ quantity: "desc" }, { acquiredAt: "asc" }],
  });
}

export async function addCollectionItem(
  userId: string,
  variantId: string,
  condition: CardCondition = "EXCELLENT",
  quantity = 1,
  editionPreset: EditionPresetCode = DEFAULT_EDITION_PRESET,
): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");

  // Le preset stocké doit toujours refléter l'édition réelle : sur une variante
  // déjà cataloguée « 1ère édition », toute possession en est une. Sans cette
  // normalisation, la même carte se scinderait en deux piles pour un seul et
  // même exemplaire réel.
  const preset: EditionPresetCode = isFirstEditionLabel(variant.editionLabel) ? "first" : editionPreset;

  await prisma.collectionItem.upsert({
    where: itemKey(userId, variantId, condition, preset),
    create: {
      userId,
      variantId,
      condition,
      quantity,
      editionPreset: preset,
      // Le libellé n'est renseigné que s'il apporte une information absente du
      // catalogue de la variante (qui peut déjà porter « 1ère édition »).
      editionLabel: isFirstEditionLabel(variant.editionLabel) ? null : editionPresetToLabel(preset),
    },
    update: { quantity: { increment: quantity } },
  });
  scheduleBadgeEvaluation(userId);
}

export async function removeCollectionItem(
  userId: string,
  variantId: string,
  condition: CardCondition = "EXCELLENT",
  editionPreset: EditionPresetCode = DEFAULT_EDITION_PRESET,
): Promise<void> {
  const item = await prisma.collectionItem.findUnique({
    where: itemKey(userId, variantId, condition, editionPreset),
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
  editionPreset: EditionPresetCode = DEFAULT_EDITION_PRESET,
): Promise<void> {
  if (quantity <= 0) {
    await removeCollectionItem(userId, variantId, condition, editionPreset);
    return;
  }

  const item = await prisma.collectionItem.findUnique({
    where: itemKey(userId, variantId, condition, editionPreset),
    select: { reservedQuantity: true },
  });
  if (item && quantity < item.reservedQuantity) throw new Error("BELOW_RESERVED");

  await prisma.collectionItem.upsert({
    where: itemKey(userId, variantId, condition, editionPreset),
    create: { userId, variantId, condition, quantity, editionPreset },
    update: { quantity },
  });
  scheduleBadgeEvaluation(userId);
}

/** Client Prisma ou client de transaction — les transferts s'exécutent dans une tx. */
type PrismaLike = Pick<typeof prisma, "collectionItem">;

/**
 * Transfère des exemplaires d'un membre à un autre (vente conclue, échange validé).
 *
 * L'exemplaire cédé était réservé : on décrémente la ligne source précise et on
 * crédite l'acheteur dans la MÊME édition. Un `updateMany` sur (user, variante,
 * état) toucherait maintenant les deux éditions à la fois, puisque l'édition fait
 * partie de la clé d'unicité.
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
    orderBy: [{ reservedQuantity: "desc" }, { quantity: "desc" }],
    select: { id: true, editionPreset: true, editionLabel: true },
  });
  // Repli : réservation déjà retombée (annulation, purge) — on prend la pile
  // la plus fournie pour ne pas bloquer la conclusion de la transaction.
  const fallback = source
    ? null
    : await tx.collectionItem.findFirst({
        where: { userId: fromUserId, variantId, condition, quantity: { gt: 0 } },
        orderBy: [{ quantity: "desc" }],
        select: { id: true, editionPreset: true, editionLabel: true },
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

  const editionPreset = (from?.editionPreset as EditionPresetCode) ?? DEFAULT_EDITION_PRESET;
  await tx.collectionItem.upsert({
    where: itemKey(toUserId, variantId, condition, editionPreset),
    create: {
      userId: toUserId,
      variantId,
      condition,
      quantity,
      editionPreset,
      editionLabel: from?.editionLabel ?? null,
    },
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

/** +1 / −1 sur une carte du classeur (toutes versions confondues côté affichage). */
export async function adjustCollectionCardQuantity(
  userId: string,
  ref: CardRef,
  delta: 1 | -1,
  condition: CardCondition = DEFAULT_CONDITION,
  edition: CollectionEdition | null = null,
): Promise<void> {
  const card = await findCardForAdjust(ref);
  if (!card) throw new Error("CARD_NOT_FOUND");

  const standardVariants = card.variants.filter((v) => v.versionType.code === "standard");

  const wantedPreset = collectionEditionToPreset(edition);

  if (delta === 1) {
    // Sur l'onglet « 1ère édition », l'exemplaire ajouté doit atterrir dans ce
    // compartiment, sinon la carte reste affichée comme manquante après ajout.
    const wantFirst = edition === "first";
    const standard =
      (edition
        ? standardVariants.find((v) => isFirstEditionLabel(v.editionLabel) === wantFirst)
        : undefined) ??
      standardVariants[0] ??
      card.variants[0];
    if (!standard) throw new Error("VARIANT_NOT_FOUND");
    await addCollectionItem(userId, standard.id, condition, 1, wantedPreset ?? DEFAULT_EDITION_PRESET);
    return;
  }

  const allItems = await prisma.collectionItem.findMany({
    where: {
      userId,
      variant: { cardId: card.id },
      quantity: { gt: 0 },
    },
    orderBy: [{ variant: { versionType: { sortOrder: "asc" } } }],
    select: {
      id: true,
      variantId: true,
      condition: true,
      quantity: true,
      reservedQuantity: true,
      editionLabel: true,
      editionPreset: true,
      variant: { select: { editionLabel: true } },
    },
  });

  // Le « − » ne doit retirer que dans le compartiment d'édition affiché.
  const items = wantedPreset
    ? allItems.filter(
        (i) =>
          effectiveEditionPreset(i.editionPreset, i.editionLabel, i.variant.editionLabel) === wantedPreset,
      )
    : allItems;

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

  // On retire sur la ligne effectivement trouvée : son propre preset, pas celui
  // de l'onglet (une réédition peut vivre sur une variante « 1ère édition »).
  const targetPreset = (target.editionPreset as EditionPresetCode) ?? DEFAULT_EDITION_PRESET;
  if (nextQty <= 0) {
    await removeCollectionItem(userId, target.variantId, target.condition, targetPreset);
  } else {
    await updateCollectionQuantity(userId, target.variantId, nextQty, target.condition, targetPreset);
  }
}

/** +1 / −1 sur une version précise (toutes conditions agrégées côté affichage). */
export async function adjustCollectionVariantQuantity(
  userId: string,
  variantId: string,
  delta: 1 | -1,
  condition: CardCondition = DEFAULT_CONDITION,
  editionPreset: EditionPresetCode = DEFAULT_EDITION_PRESET,
): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");

  if (delta === 1) {
    await addCollectionItem(userId, variantId, condition, 1, editionPreset);
    return;
  }

  const items = await prisma.collectionItem.findMany({
    where: { userId, variantId, quantity: { gt: 0 } },
    orderBy: [{ condition: "asc" }],
    select: {
      id: true,
      condition: true,
      quantity: true,
      reservedQuantity: true,
      editionPreset: true,
    },
  });

  if (items.length === 0) return;

  const inEdition = items.filter((i) => i.editionPreset === editionPreset);
  const pool = inEdition.length > 0 ? inEdition : items;

  const target =
    pool.find((i) => i.condition === condition && i.quantity > i.reservedQuantity) ??
    pool.find((i) => i.condition === condition) ??
    pool.find((i) => i.condition === DEFAULT_CONDITION && i.quantity > i.reservedQuantity) ??
    pool.find((i) => i.quantity > i.reservedQuantity) ??
    pool[0];

  if (!target) throw new Error("RESERVED");

  const nextQty = target.quantity - 1;
  if (nextQty < target.reservedQuantity) throw new Error("BELOW_RESERVED");

  const targetPreset = (target.editionPreset as EditionPresetCode) ?? DEFAULT_EDITION_PRESET;
  if (nextQty <= 0) {
    await removeCollectionItem(userId, variantId, target.condition, targetPreset);
  } else {
    await updateCollectionQuantity(userId, variantId, nextQty, target.condition, targetPreset);
  }
}

/**
 * Reclasse un exemplaire possédé dans l'autre édition.
 *
 * L'édition faisant partie de la clé d'unicité, la bascule peut heurter une ligne
 * déjà présente dans l'édition cible : on fusionne alors les quantités plutôt que
 * de laisser remonter une violation de contrainte.
 */
export async function updateCollectionEdition(
  userId: string,
  variantId: string,
  targetPreset: EditionPresetCode,
  condition: CardCondition = "EXCELLENT",
  fromPreset: EditionPresetCode = DEFAULT_EDITION_PRESET,
): Promise<void> {
  if (targetPreset === fromPreset) return;

  const [source, existing, variant] = await Promise.all([
    prisma.collectionItem.findUnique({
      where: itemKey(userId, variantId, condition, fromPreset),
      select: { id: true, quantity: true, reservedQuantity: true },
    }),
    prisma.collectionItem.findUnique({
      where: itemKey(userId, variantId, condition, targetPreset),
      select: { id: true },
    }),
    prisma.cardVariant.findUnique({ where: { id: variantId }, select: { editionLabel: true } }),
  ]);
  if (!source) throw new Error("NOT_FOUND");
  // Un exemplaire engagé dans une annonce ou un échange ne peut pas changer
  // d'édition : l'acheteur s'est positionné sur ce qui était affiché.
  if (source.reservedQuantity > 0) throw new Error("RESERVED");

  const editionLabel = isFirstEditionLabel(variant?.editionLabel)
    ? null
    : editionPresetToLabel(targetPreset);

  if (!existing) {
    await prisma.collectionItem.update({
      where: { id: source.id },
      data: { editionPreset: targetPreset, editionLabel },
    });
    return;
  }

  await prisma.$transaction([
    prisma.collectionItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: source.quantity } },
    }),
    // Les photos suivent l'exemplaire, sinon la suppression les emporterait
    // en cascade avec la ligne source.
    prisma.collectionItemPhoto.updateMany({
      where: { collectionItemId: source.id },
      data: { collectionItemId: existing.id },
    }),
    prisma.collectionItem.delete({ where: { id: source.id } }),
  ]);
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
  editionPreset?: EditionPresetCode,
): Promise<void> {
  const item = await findOwnedItem(userId, variantId, condition, editionPreset);
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
  editionPreset?: EditionPresetCode,
): Promise<void> {
  const item = await findOwnedItem(userId, variantId, condition, editionPreset);
  if (!item) throw new Error("NOT_FOUND");

  const author = signatureAuthor?.trim() || null;

  await prisma.collectionItem.update({
    where: { id: item.id },
    data: isSigned
      ? { isSigned: true, signatureAuthor: author }
      : { isSigned: false, signatureAuthor: null },
  });
}
