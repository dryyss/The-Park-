import "server-only";
import { prisma } from "@/lib/prisma";

export async function toggleCardLike(userId: string, cardId: string): Promise<{ liked: boolean; count: number }> {
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { id: true } });
  if (!card) throw new Error("CARD_NOT_FOUND");

  const existing = await prisma.cardLike.findUnique({
    where: { userId_cardId: { userId, cardId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.cardLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.cardLike.create({ data: { userId, cardId } });
  }

  const count = await prisma.cardLike.count({ where: { cardId } });
  return { liked: !existing, count };
}
