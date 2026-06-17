"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createReport } from "@/server/moderation/moderation.service";
import { conversationInvolvesMinor } from "@/server/messaging/conversation.service";
import {
  getOrCreateDirectConversation,
  markConversationRead,
  sendConversationMessage,
} from "@/server/messaging/messaging.mutations";

export type MessagingActionResult = { ok: true; messageId?: string } | { ok: false; error: string };

const sendSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function sendMessageAction(input: unknown): Promise<MessagingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const messageId = await sendConversationMessage(viewer.id, parsed.data.conversationId, parsed.data.body);
    revalidatePath("/messages");
    revalidatePath(`/messages/${parsed.data.conversationId}`);
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

const contactSchema = z.object({
  sellerSlug: z.string().min(1),
  locale: z.string().min(1),
});

/**
 * Action de formulaire « Contacter » : ouvre (ou crée) la conversation avec le vendeur
 * puis redirige vers le fil de discussion. Redirige vers la connexion si non authentifié.
 */
export async function contactSellerAction(formData: FormData): Promise<void> {
  const parsed = contactSchema.safeParse({
    sellerSlug: formData.get("sellerSlug"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return;
  const { sellerSlug, locale } = parsed.data;

  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/marketplace`)}`);
  }

  const seller = await prisma.user.findUnique({ where: { slug: sellerSlug }, select: { id: true } });
  if (!seller) redirect(`/${locale}/marketplace`);
  if (seller.id === viewer.id) redirect(`/${locale}/dashboard`);

  const conversationId = await getOrCreateDirectConversation(viewer.id, seller.id);
  redirect(`/${locale}/messages/${conversationId}`);
}

export async function markConversationReadAction(conversationId: string): Promise<MessagingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  await markConversationRead(viewer.id, conversationId);
  revalidatePath("/messages");
  return { ok: true };
}

const reportMessageSchema = z.object({
  messageId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

/** Signale un message dans une conversation dont le viewer est participant. */
export async function reportMessageAction(input: unknown): Promise<MessagingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = reportMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const message = await prisma.message.findUnique({
    where: { id: parsed.data.messageId },
    select: { id: true, senderId: true, conversationId: true },
  });
  if (!message) return { ok: false, error: "NOT_FOUND" };
  if (message.senderId === viewer.id) return { ok: false, error: "SELF_REPORT" };

  const participation = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId: viewer.id } },
  });
  if (!participation) return { ok: false, error: "FORBIDDEN" };

  const involvesMinor = await conversationInvolvesMinor(message.conversationId);

  try {
    await createReport(viewer.id, {
      targetType: "MESSAGE",
      targetId: message.id,
      reason: parsed.data.reason,
      involvesMinor,
    });
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
