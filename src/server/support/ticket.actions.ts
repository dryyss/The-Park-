"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupportTicketStatus } from "@/generated/prisma/client";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  createTicket,
  postTicketMessage,
  setTicketStatus,
} from "@/server/support/ticket.service";

export type TicketActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const createSchema = z.object({
  subject: z.string().min(3).max(160),
  category: z.string().min(1),
  body: z.string().min(5).max(5000),
});

export async function createTicketAction(input: unknown): Promise<TicketActionResult<{ id: string }>> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const id = await createTicket(viewer.id, parsed.data);
    revalidatePath("/support");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

const replySchema = z.object({ ticketId: z.string().min(1), body: z.string().min(1).max(5000) });

export async function replyTicketAction(input: unknown): Promise<TicketActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await postTicketMessage(
      parsed.data.ticketId,
      { id: viewer.id, isStaff: viewer.staffRole != null },
      parsed.data.body,
    );
    revalidatePath(`/support/${parsed.data.ticketId}`);
    revalidatePath("/support");
    revalidatePath("/admin/support");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

const STATUSES: SupportTicketStatus[] = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];

export async function setTicketStatusAction(ticketId: string, status: string): Promise<TicketActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  if (viewer.staffRole == null) return { ok: false, error: "FORBIDDEN" };
  if (!STATUSES.includes(status as SupportTicketStatus)) return { ok: false, error: "VALIDATION" };

  try {
    await setTicketStatus(ticketId, status as SupportTicketStatus);
    revalidatePath(`/support/${ticketId}`);
    revalidatePath("/admin/support");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
