import "server-only";
import { prisma } from "@/lib/prisma";
import { pushUserEvent } from "@/lib/pusher";
import { dispatchNotification } from "@/server/notification/notification.mutations";

/** Envoie un message dans une conversation contextualisée (texte et/ou photos). */
export async function sendConversationMessage(
  senderId: string,
  conversationId: string,
  body: string,
  attachmentUrls: string[] = [],
): Promise<string> {
  const trimmed = body.trim();
  const attachments = attachmentUrls.filter(Boolean);
  if (!trimmed && attachments.length === 0) throw new Error("EMPTY_MESSAGE");
  if (trimmed.length > 2000) throw new Error("TOO_LONG");
  if (attachments.length > 4) throw new Error("TOO_MANY_ATTACHMENTS");

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
      data: {
        conversationId,
        senderId,
        body: trimmed || " ",
        attachments,
      },
      include: { sender: { select: { displayName: true } } },
    });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: new Date() },
    });
    return created;
  });

  const preview = trimmed || (attachments.length > 0 ? "📷 Photo" : "");

  const chatPayload = {
    conversationId,
    message: {
      id: message.id,
      body: message.body.trim() ? message.body : "",
      attachments: message.attachments,
      senderId,
      senderName: message.sender.displayName,
      senderInitial: message.sender.displayName.charAt(0).toUpperCase(),
      createdAt: message.createdAt.toISOString(),
    },
  };

  for (const p of participation.conversation.participants) {
    await dispatchNotification({
      userId: p.userId,
      type: "MESSAGE_RECEIVED",
      actorId: senderId,
      entityType: "CONVERSATION",
      entityId: conversationId,
      payload: { preview: preview.slice(0, 120) },
    });
    await pushUserEvent(p.userId, "chat-message", {
      ...chatPayload,
      message: { ...chatPayload.message, isViewer: false },
    });
  }

  await pushUserEvent(senderId, "chat-message", {
    ...chatPayload,
    message: { ...chatPayload.message, isViewer: true },
  });

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
