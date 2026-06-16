"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { markConversationRead, sendConversationMessage } from "@/server/messaging/messaging.mutations";

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

export async function markConversationReadAction(conversationId: string): Promise<MessagingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  await markConversationRead(viewer.id, conversationId);
  revalidatePath("/messages");
  return { ok: true };
}
