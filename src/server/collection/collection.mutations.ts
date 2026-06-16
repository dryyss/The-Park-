import "server-only";
import { prisma } from "@/lib/prisma";
import type { CardCondition } from "@/generated/prisma/client";
export async function addCollectionItem(
  userId: string,
  variantId: string,
  condition: CardCondition = "EXCELLENT",
  quantity = 1,
): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");

  await prisma.collectionItem.upsert({
    where: { userId_variantId_condition: { userId, variantId, condition } },
    create: { userId, variantId, condition, quantity },
    update: { quantity: { increment: quantity } },
  });
}

export async function removeCollectionItem(
  userId: string,
  variantId: string,
  condition: CardCondition = "EXCELLENT",
): Promise<void> {
  const item = await prisma.collectionItem.findUnique({
    where: { userId_variantId_condition: { userId, variantId, condition } },
    select: { id: true, reservedQuantity: true },
  });
  if (!item) throw new Error("NOT_FOUND");
  if (item.reservedQuantity > 0) throw new Error("RESERVED");

  await prisma.collectionItem.delete({ where: { id: item.id } });
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
    where: { userId_variantId_condition: { userId, variantId, condition } },
    select: { reservedQuantity: true },
  });
  if (item && quantity < item.reservedQuantity) throw new Error("BELOW_RESERVED");

  await prisma.collectionItem.upsert({
    where: { userId_variantId_condition: { userId, variantId, condition } },
    create: { userId, variantId, condition, quantity },
    update: { quantity },
  });
}

const DEFAULT_CONDITION: CardCondition = "EXCELLENT";

/** +1 / −1 sur une carte du classeur (toutes versions confondues côté affichage). */
export async function adjustCollectionCardQuantity(
  userId: string,
  cardNumber: number,
  delta: 1 | -1,
  condition: CardCondition = DEFAULT_CONDITION,
): Promise<void> {
  const card = await prisma.card.findFirst({
    where: { number: cardNumber },
    include: { variants: { include: { versionType: true } } },
  });
  if (!card) throw new Error("CARD_NOT_FOUND");

  if (delta === 1) {
    const standard =
      card.variants.find((v) => v.versionType.code === "standard") ?? card.variants[0];
    if (!standard) throw new Error("VARIANT_NOT_FOUND");
    await addCollectionItem(userId, standard.id, condition, 1);
    return;
  }

  const items = await prisma.collectionItem.findMany({
    where: {
      userId,
      variant: { cardId: card.id },
      quantity: { gt: 0 },
    },
    orderBy: [{ variant: { versionType: { sortOrder: "asc" } } }],
    select: { id: true, variantId: true, condition: true, quantity: true, reservedQuantity: true },
  });

  if (items.length === 0) return;

  const standardVariantId = card.variants.find((v) => v.versionType.code === "standard")?.id;
  const target =
    items.find((i) => i.variantId === standardVariantId && i.condition === condition) ??
    items.find((i) => i.variantId === standardVariantId && i.condition === DEFAULT_CONDITION) ??
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
  const variant = await prisma.cardVariant.findUnique({ where: { id: variantId } });
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

/** Met à jour l'édition précisée sur un exemplaire possédé. */
export async function updateCollectionEdition(
  userId: string,
  variantId: string,
  editionLabel: string | null,
  condition: CardCondition = "EXCELLENT",
): Promise<void> {
  const item = await prisma.collectionItem.findUnique({
    where: { userId_variantId_condition: { userId, variantId, condition } },
    select: { id: true },
  });
  if (!item) throw new Error("NOT_FOUND");

  await prisma.collectionItem.update({
    where: { id: item.id },
    data: { editionLabel },
  });
}
