import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";

/** Envoie un message dans une conversation contextualisée. */
export async function sendConversationMessage(
  senderId: string,
  conversationId: string,
  body: string,
): Promise<string> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("EMPTY_MESSAGE");
  if (trimmed.length > 2000) throw new Error("TOO_LONG");

  const participation = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: senderId } },
    include: {
      conversation: {
        include: {
          participants: { where: { userId: { not: senderId } }, select: { userId: true } },
        },
      },
    },
  });
  if (!participation) throw new Error("FORBIDDEN");

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId, senderId, body: trimmed },
    });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: new Date() },
    });
    return created;
  });

  for (const p of participation.conversation.participants) {
    await dispatchNotification({
      userId: p.userId,
      type: "MESSAGE_RECEIVED",
      actorId: senderId,
      entityType: "CONVERSATION",
      entityId: conversationId,
      payload: { preview: trimmed.slice(0, 120) },
    });
  }

  return message.id;
}

/**
 * Récupère (ou crée) la conversation directe vendeur ↔ acheteur d'un contact marketplace.
 * Contexte SALE non rattaché à une vente/échange précis : une seule conversation par binôme.
 */
export async function getOrCreateDirectConversation(viewerId: string, partnerId: string): Promise<string> {
  if (viewerId === partnerId) throw new Error("SELF_CONTACT");

  const existing = await prisma.conversation.findFirst({
    where: {
      context: "SALE",
      saleId: null,
      exchangeId: null,
      auctionId: null,
      disputeId: null,
      AND: [
        { participants: { some: { userId: viewerId } } },
        { participants: { some: { userId: partnerId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const conv = await prisma.conversation.create({
    data: {
      context: "SALE",
      participants: { create: [{ userId: viewerId }, { userId: partnerId }] },
    },
    select: { id: true },
  });
  return conv.id;
}

/** Marque une conversation comme lue. */
export async function markConversationRead(userId: string, conversationId: string): Promise<void> {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
}
