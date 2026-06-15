import "server-only";
import { prisma } from "@/lib/prisma";

export async function addWishlistItem(userId: string, cardId: string, note?: string): Promise<string> {
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { id: true } });
  if (!card) throw new Error("CARD_NOT_FOUND");

  const item = await prisma.wishlistItem.upsert({
    where: { userId_cardId: { userId, cardId } },
    create: { userId, cardId, note: note ?? null },
    update: { note: note ?? null },
  });
  return item.id;
}

export async function removeWishlistItem(userId: string, wishlistItemId: string): Promise<void> {
  const deleted = await prisma.wishlistItem.deleteMany({
    where: { id: wishlistItemId, userId },
  });
  if (deleted.count === 0) throw new Error("NOT_FOUND");
}
