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
