import "server-only";
import { prisma } from "@/lib/prisma";
import type { ProofKind, ShipmentType } from "@/generated/prisma/client";

export function todayDropToken(): string {
  const d = new Date();
  return `TP-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Crée un envoi sécurisé pour un échange accepté. */
export async function createShipmentForExchange(exchangeId: string, shipperId: string): Promise<string> {
  const ex = await prisma.exchange.findFirst({
    where: { id: exchangeId, status: { in: ["ACCEPTED", "AWAITING_SHIPMENT"] } },
    select: { id: true, initiatorId: true, recipientId: true, secured: true },
  });
  if (!ex) throw new Error("EXCHANGE_NOT_FOUND");

  const recipientId = ex.initiatorId === shipperId ? ex.recipientId : ex.initiatorId;
  const notShipDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const shipment = await prisma.shipment.create({
    data: {
      type: "EXCHANGE" satisfies ShipmentType,
      secured: ex.secured,
      exchangeId: ex.id,
      shipperId,
      recipientId,
      dropToken: todayDropToken(),
      dropTokenDate: new Date(),
      notShipDeadline,
      status: "PENDING",
    },
  });

  await prisma.exchange.update({
    where: { id: exchangeId },
    data: { status: "AWAITING_SHIPMENT" },
  });

  await prisma.transactionEvent.create({
    data: {
      entityType: "EXCHANGE",
      entityId: exchangeId,
      fromStatus: "ACCEPTED",
      toStatus: "AWAITING_SHIPMENT",
      event: "SHIPMENT_CREATED",
      actorId: shipperId,
      metadata: { shipmentId: shipment.id },
    },
  });

  return shipment.id;
}

/** Enregistre une preuve vidéo (métadonnées — upload média hors scope). */
export async function recordShipmentProof(
  shipmentId: string,
  uploaderId: string,
  input: {
    kind: ProofKind;
    mediaUrl: string;
    mediaHash: string;
    durationSec: number;
    tokenShown?: string;
  },
): Promise<string> {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, shipperId: uploaderId },
  });
  if (!shipment) throw new Error("SHIPMENT_NOT_FOUND");

  const proof = await prisma.shipmentProof.create({
    data: {
      shipmentId,
      kind: input.kind,
      mediaUrl: input.mediaUrl,
      mediaHash: input.mediaHash,
      durationSec: input.durationSec,
      tokenShown: input.tokenShown ?? shipment.dropToken,
      serverRecordedAt: new Date(),
    },
  });

  return proof.id;
}

/** Purge RGPD des preuves vidéo > 60 j après clôture (job cron). */
export async function purgeExpiredShipmentProofs(): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const result = await prisma.shipmentProof.deleteMany({
    where: {
      serverRecordedAt: { lt: cutoff },
      shipment: { status: { in: ["DELIVERED", "RETURNED", "LOST"] } },
    },
  });
  return result.count;
}

/** Marque un colis comme expédié avec numéro de suivi. */
export async function markShipmentShipped(
  shipmentId: string,
  shipperId: string,
  trackingNumber: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id: shipmentId, shipperId },
      data: { status: "SHIPPED", trackingNumber },
    });

    if (shipment.exchangeId) {
      await tx.exchange.update({
        where: { id: shipment.exchangeId },
        data: { status: "SHIPPED" },
      });
      await tx.transactionEvent.create({
        data: {
          entityType: "EXCHANGE",
          entityId: shipment.exchangeId,
          fromStatus: "AWAITING_SHIPMENT",
          toStatus: "SHIPPED",
          event: "TRACKING_ADDED",
          actorId: shipperId,
          metadata: { trackingNumber },
        },
      });
    }
  });
}
