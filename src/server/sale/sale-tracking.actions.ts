"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  createShipmentForSale,
  confirmSaleReceipt,
  openSaleDispute,
} from "@/server/sale/sale-lifecycle.service";
import { markShipmentShipped } from "@/server/c2c/shipment.service";
import { markShipmentDelivered } from "@/server/c2c/exchange-lifecycle.service";
import { prisma } from "@/lib/prisma";

export type SaleTrackingActionResult = { ok: true; id?: string } | { ok: false; error: string };

const shipSchema = z.object({
  shipmentId: z.string().min(1),
  trackingNumber: z.string().min(3).max(64),
  carrier: z.enum(["LAPOSTE", "COLISSIMO", "CHRONOPOST", "MONDIAL_RELAY", "OTHER"]).optional(),
});

function revalidateSalePages() {
  revalidatePath("/marketplace", "layout");
  revalidatePath("/dashboard", "layout");
}

/** Le vendeur ouvre l'envoi (PAID → AWAITING_SHIPMENT, jeton du jour, délai J+3). */
export async function createSaleShipmentAction(saleId: string): Promise<SaleTrackingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const id = await createShipmentForSale(saleId, viewer.id);
    revalidateSalePages();
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

/** Le vendeur saisit transporteur + n° de suivi (AWAITING_SHIPMENT → SHIPPED). */
export async function markSaleShippedAction(input: unknown): Promise<SaleTrackingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = shipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await markShipmentShipped(
      parsed.data.shipmentId,
      viewer.id,
      parsed.data.trackingNumber,
      parsed.data.carrier,
    );
    revalidateSalePages();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

/** L'acheteur signale la livraison (SHIPPED → DELIVERED_WINDOW, garantie 72 h). */
export async function markSaleDeliveredAction(saleId: string): Promise<SaleTrackingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const shipment = await prisma.shipment.findFirst({
      where: { saleId, recipientId: viewer.id, status: "SHIPPED" },
      select: { id: true },
    });
    if (!shipment) return { ok: false, error: "NOT_FOUND" };
    await markShipmentDelivered(shipment.id, viewer.id);
    revalidateSalePages();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

/** L'acheteur valide la réception → fonds crédités au vendeur, carte transférée. */
export async function confirmSaleReceiptAction(saleId: string): Promise<SaleTrackingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await confirmSaleReceipt(saleId, viewer.id);
    revalidateSalePages();
    revalidatePath("/portefeuille");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

/** Acheteur ou vendeur ouvre un litige (gèle le versement au vendeur). */
export async function openSaleDisputeAction(saleId: string, reason: string): Promise<SaleTrackingActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const trimmed = reason.trim();
  if (trimmed.length < 10) return { ok: false, error: "VALIDATION" };

  try {
    await openSaleDispute(saleId, viewer.id, trimmed);
    revalidateSalePages();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
