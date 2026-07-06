"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  createShipmentForExchange,
  markShipmentShipped,
  recordShipmentProof,
} from "@/server/c2c/shipment.service";
import { authorizeExchangeCaution } from "@/server/c2c/caution.service";
import { confirmExchangeReceipt, markShipmentDelivered } from "@/server/c2c/exchange-lifecycle.service";
import { prisma } from "@/lib/prisma";

export type C2CActionResult = { ok: true; id?: string } | { ok: false; error: string };

const trackingSchema = z.object({
  shipmentId: z.string().min(1),
  trackingNumber: z.string().min(3).max(64),
});

const proofSchema = z.object({
  shipmentId: z.string().min(1),
  kind: z.enum(["PRESENTATION", "ENVELOPE", "CLOSURE_ADDRESS", "DROP_RECEIPT", "UNBOXING"]),
  mediaUrl: z.string().url(),
  mediaHash: z.string().min(32).max(128),
  durationSec: z.number().int().min(1).max(600),
  /** Jeton du jour affiché/incrusté dans la vidéo (anti-réutilisation). */
  tokenShown: z.string().max(32).optional(),
});

export async function createExchangeShipmentAction(exchangeId: string): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const id = await createShipmentForExchange(exchangeId, viewer.id);
    revalidatePath("/securite", "layout");
    revalidatePath("/echanges");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function markShippedAction(input: unknown): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await markShipmentShipped(parsed.data.shipmentId, viewer.id, parsed.data.trackingNumber);
    revalidatePath("/securite", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function recordProofAction(input: unknown): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const id = await recordShipmentProof(parsed.data.shipmentId, viewer.id, parsed.data);
    revalidatePath("/securite", "layout");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function openDisputeAction(exchangeId: string, reason: string): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const trimmed = reason.trim();
  if (trimmed.length < 10) return { ok: false, error: "VALIDATION" };

  const ex = await prisma.exchange.findFirst({
    where: {
      id: exchangeId,
      OR: [{ initiatorId: viewer.id }, { recipientId: viewer.id }],
      status: { in: ["SHIPPED", "DELIVERED_WINDOW", "DELIVERED"] },
    },
  });
  if (!ex) return { ok: false, error: "NOT_FOUND" };

  const respondentId = ex.initiatorId === viewer.id ? ex.recipientId : ex.initiatorId;
  await prisma.$transaction(async (tx) => {
    await tx.dispute.create({
      data: {
        type: "EXCHANGE",
        exchangeId,
        reason: trimmed,
        claimantId: viewer.id,
        respondentId,
        involvesMinor: false,
        priority: 5,
      },
    });
    await tx.exchange.update({ where: { id: exchangeId }, data: { status: "DISPUTED" } });
  });

  revalidatePath("/securite", "layout");
  return { ok: true };
}

export async function authorizeCautionAction(exchangeId: string): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const shipment = await prisma.shipment.findFirst({
      where: { exchangeId, shipperId: viewer.id },
      select: { id: true },
    });
    const { paymentId } = await authorizeExchangeCaution(exchangeId, viewer.id, shipment?.id);
    revalidatePath("/securite", "layout");
    return { ok: true, id: paymentId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function markDeliveredAction(shipmentId: string): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await markShipmentDelivered(shipmentId, viewer.id);
    revalidatePath("/securite", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function confirmReceiptAction(exchangeId: string): Promise<C2CActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await confirmExchangeReceipt(exchangeId, viewer.id);
    revalidatePath("/securite", "layout");
    revalidatePath("/echanges");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
