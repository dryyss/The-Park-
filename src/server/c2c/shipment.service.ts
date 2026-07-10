import "server-only";
import { prisma } from "@/lib/prisma";
import type { ProofKind, ShipmentType } from "@/generated/prisma/client";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { cellarDelete } from "@/lib/cellar";
import { todayDropToken } from "@/lib/drop-token";

export { todayDropToken };

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
  // L'expéditeur filme l'emballage/dépôt ; le destinataire filme le déballage.
  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      ...(input.kind === "UNBOXING"
        ? { OR: [{ shipperId: uploaderId }, { recipientId: uploaderId }] }
        : { shipperId: uploaderId }),
    },
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
  const expired = await prisma.shipmentProof.findMany({
    where: {
      serverRecordedAt: { lt: cutoff },
      shipment: { status: { in: ["DELIVERED", "RETURNED", "LOST"] } },
    },
    select: { id: true, mediaUrl: true },
  });
  if (expired.length === 0) return 0;

  // Supprime aussi le fichier vidéo sur Cellar (best-effort) — évite les fichiers
  // orphelins et complète la purge RGPD. cellarDelete ignore les URLs non-Cellar.
  for (const p of expired) {
    if (p.mediaUrl) await cellarDelete(p.mediaUrl);
  }

  const result = await prisma.shipmentProof.deleteMany({
    where: { id: { in: expired.map((p) => p.id) } },
  });
  return result.count;
}

/** Marque un colis comme expédié avec numéro de suivi (et transporteur). */
export async function markShipmentShipped(
  shipmentId: string,
  shipperId: string,
  trackingNumber: string,
  carrier?: import("@/generated/prisma/client").Carrier,
): Promise<void> {
  let recipientId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id: shipmentId, shipperId },
      data: { status: "SHIPPED", trackingNumber, shippedAt: new Date(), ...(carrier ? { carrier } : {}) },
    });

    recipientId = shipment.recipientId;

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

    if (shipment.saleId) {
      await tx.sale.update({
        where: { id: shipment.saleId },
        data: { status: "SHIPPED" },
      });
      await tx.transactionEvent.create({
        data: {
          entityType: "SALE",
          entityId: shipment.saleId,
          fromStatus: "AWAITING_SHIPMENT",
          toStatus: "SHIPPED",
          event: "TRACKING_ADDED",
          actorId: shipperId,
          metadata: { trackingNumber, ...(carrier ? { carrier } : {}) },
        },
      });
    }
  });

  if (recipientId) {
    await dispatchNotification({
      userId: recipientId,
      type: "SHIPMENT_SHIPPED",
      actorId: shipperId,
      entityType: "SHIPMENT",
      entityId: shipmentId,
      payload: { trackingNumber },
    });
  }
}
