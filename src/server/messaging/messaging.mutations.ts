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

/** Marque une conversation comme lue. */
export async function markConversationRead(userId: string, conversationId: string): Promise<void> {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
}
