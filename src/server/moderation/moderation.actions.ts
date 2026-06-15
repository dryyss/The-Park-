"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { requireModule } from "@/server/auth/admin-guard";
import { createReport, resolveReport, updateDisputeStatus } from "@/server/moderation/moderation.service";
import { createShipmentForExchange, markShipmentShipped, recordShipmentProof } from "@/server/c2c/shipment.service";
import { requestParentalConsent, verifyParentalConsent } from "@/server/user/parental-consent.service";

export type ModerationActionResult = { ok: true } | { ok: false; error: string };

const reportSchema = z.object({
  targetType: z.enum(["USER", "LISTING", "MESSAGE", "REVIEW", "SHOP", "AUCTION"]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(500),
  involvesMinor: z.boolean().optional(),
});

export async function createReportAction(input: unknown): Promise<ModerationActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await createReport(viewer.id, parsed.data);
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function resolveReportAction(reportId: string, status: "RESOLVED" | "DISMISSED"): Promise<ModerationActionResult> {
  const access = await requireModule("moderation");
  if (!access.ok) return { ok: false, error: access.reason };

  try {
    await resolveReport(access.user.id, reportId, status);
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateDisputeStatusAction(
  disputeId: string,
  status: "OPEN" | "UNDER_REVIEW" | "AWAITING_EVIDENCE" | "RESOLVED" | "CLOSED",
): Promise<ModerationActionResult> {
  const access = await requireModule("moderation");
  if (!access.ok) return { ok: false, error: access.reason };

  try {
    await updateDisputeStatus(access.user.id, disputeId, status);
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function createExchangeShipmentAction(exchangeId: string): Promise<ModerationActionResult & { shipmentId?: string }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const shipmentId = await createShipmentForExchange(exchangeId, viewer.id);
    revalidatePath("/securite", "layout");
    revalidatePath("/echanges");
    return { ok: true, shipmentId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function markShipmentShippedAction(
  shipmentId: string,
  trackingNumber: string,
): Promise<ModerationActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await markShipmentShipped(shipmentId, viewer.id, trackingNumber);
    revalidatePath("/securite", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function recordProofAction(input: {
  shipmentId: string;
  kind: "PRESENTATION" | "ENVELOPE" | "CLOSURE_ADDRESS" | "DROP_RECEIPT" | "UNBOXING";
  mediaUrl: string;
  mediaHash: string;
  durationSec: number;
}): Promise<ModerationActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await recordShipmentProof(input.shipmentId, viewer.id, input);
    revalidatePath("/securite", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function requestParentalConsentAction(guardianEmail: string, guardianName?: string): Promise<ModerationActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await requestParentalConsent(viewer.id, guardianEmail, guardianName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function verifyParentalConsentAction(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ok = await verifyParentalConsent(token);
    return ok ? { ok: true } : { ok: false, error: "INVALID_TOKEN" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
