import "server-only";
import { prisma } from "@/lib/prisma";

export async function getSaleConversationId(saleId: string): Promise<string | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { saleId },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

export async function getSaleForBuyer(saleId: string, buyerId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, buyerId },
    include: {
      listing: {
        include: {
          variant: { include: { card: { include: { rarity: true } }, versionType: true } },
        },
      },
      conversation: { select: { id: true } },
    },
  });
}
