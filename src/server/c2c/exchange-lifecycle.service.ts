import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";

const GUARANTEE_MS = 72 * 60 * 60 * 1000;

/** Marque un colis comme livré et ouvre la fenêtre garantie 72 h. */
export async function markShipmentDelivered(shipmentId: string, recipientId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id: shipmentId, recipientId },
      data: {
        status: "DELIVERED",
        deliveredAt: now,
        guaranteeStartedAt: now,
        guaranteeEndsAt: new Date(now.getTime() + GUARANTEE_MS),
      },
    });

    if (shipment.exchangeId) {
      await tx.exchange.update({
        where: { id: shipment.exchangeId },
        data: { status: "DELIVERED_WINDOW" },
      });
      await tx.transactionEvent.create({
        data: {
          entityType: "EXCHANGE",
          entityId: shipment.exchangeId,
          fromStatus: "SHIPPED",
          toStatus: "DELIVERED_WINDOW",
          event: "DELIVERED",
          actorId: recipientId,
          metadata: { shipmentId },
        },
      });
    }
  });
}

/** Clôture l'échange après fenêtre garantie (receveur confirme). */
export async function confirmExchangeReceipt(exchangeId: string, userId: string): Promise<void> {
  const ex = await prisma.exchange.findFirst({
    where: {
      id: exchangeId,
      OR: [{ initiatorId: userId }, { recipientId: userId }],
      status: { in: ["DELIVERED_WINDOW", "DELIVERED"] },
    },
    include: { items: true },
  });
  if (!ex) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.exchange.update({
      where: { id: exchangeId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    for (const item of ex.items) {
      const ownerId = item.fromInitiator ? ex.initiatorId : ex.recipientId;
      const targetId = item.fromInitiator ? ex.recipientId : ex.initiatorId;
      await tx.collectionItem.updateMany({
        where: { userId: ownerId, variantId: item.variantId, condition: item.condition },
        data: { reservedQuantity: { decrement: 1 }, quantity: { decrement: 1 } },
      });
      await tx.collectionItem.upsert({
        where: {
          userId_variantId_condition: {
            userId: targetId,
            variantId: item.variantId,
            condition: item.condition,
          },
        },
        create: {
          userId: targetId,
          variantId: item.variantId,
          condition: item.condition,
          quantity: item.quantity,
        },
        update: { quantity: { increment: item.quantity } },
      });
    }

    await tx.transactionEvent.create({
      data: {
        entityType: "EXCHANGE",
        entityId: exchangeId,
        fromStatus: ex.status,
        toStatus: "COMPLETED",
        event: "EXCHANGE_COMPLETED",
        actorId: userId,
      },
    });
  });

  const otherId = ex.initiatorId === userId ? ex.recipientId : ex.initiatorId;
  await dispatchNotification({
    userId: otherId,
    type: "EXCHANGE_COMPLETED",
    actorId: userId,
    entityType: "EXCHANGE",
    entityId: exchangeId,
  });
}

/** Timeouts J+3 non-expédition + fin fenêtre garantie — job cron. */
export async function processExchangeTimeouts(): Promise<{ notShipped: number; completed: number }> {
  const now = new Date();
  let notShipped = 0;
  let completed = 0;

  const overdueShip = await prisma.shipment.findMany({
    where: {
      status: "PENDING",
      notShipDeadline: { lte: now },
      exchangeId: { not: null },
    },
    select: { id: true, exchangeId: true, shipperId: true },
  });

  for (const s of overdueShip) {
    if (!s.exchangeId) continue;
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: s.id }, data: { status: "LOST" } });
      await tx.exchange.update({
        where: { id: s.exchangeId! },
        data: { status: "NOT_SHIPPED_CANCELLED" },
      });
      const ex = await tx.exchange.findUnique({
        where: { id: s.exchangeId! },
        include: { items: { where: { fromInitiator: true } } },
      });
      if (ex) {
        for (const item of ex.items) {
          await tx.collectionItem.updateMany({
            where: { userId: ex.initiatorId, variantId: item.variantId, condition: item.condition },
            data: { reservedQuantity: { decrement: 1 } },
          });
        }
      }
    });
    notShipped += 1;
  }

  const expiredGuarantee = await prisma.exchange.findMany({
    where: { status: "DELIVERED_WINDOW" },
    include: { shipments: true },
  });

  for (const ex of expiredGuarantee) {
    const allPast = ex.shipments.every((s) => s.guaranteeEndsAt && s.guaranteeEndsAt <= now);
    if (!allPast) continue;
    await prisma.exchange.update({ where: { id: ex.id }, data: { status: "COMPLETED", completedAt: now } });
    completed += 1;
  }

  return { notShipped, completed };
}
