import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { evaluateUserBadgesForUsers } from "@/server/badge/badge.service";
import { releaseToSeller, refundPurchase } from "@/server/sale/sale-payment.service";
import { todayDropToken } from "@/server/c2c/shipment.service";

const GUARANTEE_MS = 72 * 60 * 60 * 1000;
const NOT_SHIP_MS = 3 * 24 * 60 * 60 * 1000;

/** Pré-autorisation acquise → la vente passe en PAID (annonce vendue). Idempotent. */
export async function markSalePaid(saleId: string): Promise<void> {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw new Error("SALE_NOT_FOUND");
  if (sale.status !== "PENDING_PAYMENT") return; // idempotent (webhook rejouable)

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: saleId }, data: { status: "PAID" } });
    await tx.payment.updateMany({
      where: { saleId, kind: "PURCHASE", status: { in: ["REQUIRES_PAYMENT", "AUTHORIZED"] } },
      data: { status: "AUTHORIZED" },
    });
    await tx.listing.update({ where: { id: sale.listingId }, data: { status: "SOLD" } });
    // Purge les paniers qui pointaient vers cette annonce maintenant vendue.
    await tx.marketplaceCartItem.deleteMany({ where: { listingId: sale.listingId } });
    await tx.transactionEvent.create({
      data: {
        entityType: "SALE",
        entityId: saleId,
        fromStatus: "PENDING_PAYMENT",
        toStatus: "PAID",
        event: "PAYMENT_AUTHORIZED",
      },
    });
  });

  await dispatchNotification({
    userId: sale.sellerId,
    type: "SALE_CREATED",
    actorId: sale.buyerId,
    entityType: "SALE",
    entityId: saleId,
    payload: { amount: Number(sale.price).toFixed(2) },
  });

  await evaluateUserBadgesForUsers([sale.sellerId, sale.buyerId]);
}

/** Paiement échoué/abandonné → vente annulée, annonce réouverte. */
export async function markSaleFailed(saleId: string): Promise<void> {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.status !== "PENDING_PAYMENT") return;

  const payment = await prisma.payment.findFirst({ where: { saleId, kind: "PURCHASE" } });
  if (payment) await refundPurchase(payment.id);

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELLED" } });
    await tx.listing.update({ where: { id: sale.listingId }, data: { status: "ACTIVE" } });
    await tx.transactionEvent.create({
      data: { entityType: "SALE", entityId: saleId, fromStatus: "PENDING_PAYMENT", toStatus: "CANCELLED", event: "PAYMENT_FAILED" },
    });
  });
}

/** Le vendeur ouvre l'envoi sécurisé (PAID → AWAITING_SHIPMENT). */
export async function createShipmentForSale(saleId: string, sellerId: string): Promise<string> {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, sellerId, status: "PAID" } });
  if (!sale) throw new Error("SALE_NOT_FOUND");

  const shipment = await prisma.shipment.create({
    data: {
      type: "SALE",
      secured: true,
      saleId,
      shipperId: sellerId,
      recipientId: sale.buyerId,
      dropToken: todayDropToken(),
      dropTokenDate: new Date(),
      notShipDeadline: new Date(Date.now() + NOT_SHIP_MS),
      status: "PENDING",
    },
  });

  await prisma.sale.update({ where: { id: saleId }, data: { status: "AWAITING_SHIPMENT" } });
  await prisma.transactionEvent.create({
    data: {
      entityType: "SALE",
      entityId: saleId,
      fromStatus: "PAID",
      toStatus: "AWAITING_SHIPMENT",
      event: "SHIPMENT_CREATED",
      actorId: sellerId,
      metadata: { shipmentId: shipment.id },
    },
  });

  return shipment.id;
}

/** Transfère 1 exemplaire (état de l'annonce) du vendeur vers l'acheteur. */
async function reallocateCollection(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sellerId: string,
  buyerId: string,
  variantId: string,
  condition: "MINT" | "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR" | "DAMAGED",
): Promise<void> {
  await tx.collectionItem.updateMany({
    where: { userId: sellerId, variantId, condition },
    data: { quantity: { decrement: 1 }, reservedQuantity: { decrement: 1 } },
  });
  await tx.collectionItem.upsert({
    where: { userId_variantId_condition: { userId: buyerId, variantId, condition } },
    create: { userId: buyerId, variantId, condition, quantity: 1 },
    update: { quantity: { increment: 1 } },
  });
}

/** Clôture la vente : l'acheteur confirme la réception (ou auto via cron).
 *  Remise en main propre : confirmable dès le paiement (pas d'expédition). */
export async function confirmSaleReceipt(saleId: string, buyerId: string): Promise<void> {
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      buyerId,
      OR: [
        { status: { in: ["DELIVERED_WINDOW", "DELIVERED"] } },
        { shippingMode: "HAND_DELIVERY", status: { in: ["PAID", "AWAITING_SHIPMENT", "SHIPPED"] } },
      ],
    },
    include: { listing: true },
  });
  if (!sale) throw new Error("NOT_FOUND");

  const payment = await prisma.payment.findFirst({ where: { saleId, kind: "PURCHASE" } });
  if (payment) await releaseToSeller(payment.id);

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: saleId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await reallocateCollection(tx, sale.sellerId, sale.buyerId, sale.listing.variantId, sale.listing.condition);
    await tx.transactionEvent.create({
      data: { entityType: "SALE", entityId: saleId, fromStatus: sale.status, toStatus: "COMPLETED", event: "SALE_COMPLETED", actorId: buyerId },
    });
  });

  await dispatchNotification({
    userId: sale.sellerId,
    type: "LISTING_SOLD",
    actorId: sale.buyerId,
    entityType: "SALE",
    entityId: saleId,
    payload: { amount: Number(sale.price).toFixed(2) },
  });

  await evaluateUserBadgesForUsers([sale.sellerId, sale.buyerId]);
}

/** L'acheteur ou le vendeur ouvre un litige (gèle le déblocage des fonds). */
export async function openSaleDispute(saleId: string, userId: string, reason: string): Promise<void> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: ["SHIPPED", "DELIVERED_WINDOW", "DELIVERED"] } },
  });
  if (!sale) throw new Error("NOT_FOUND");

  const respondentId = sale.buyerId === userId ? sale.sellerId : sale.buyerId;
  await prisma.$transaction(async (tx) => {
    await tx.dispute.create({
      data: { type: "SALE", saleId, reason, claimantId: userId, respondentId, priority: 5 },
    });
    await tx.sale.update({ where: { id: saleId }, data: { status: "DISPUTED" } });
    await tx.transactionEvent.create({
      data: { entityType: "SALE", entityId: saleId, fromStatus: sale.status, toStatus: "DISPUTED", event: "DISPUTE_OPENED", actorId: userId },
    });
  });

  await dispatchNotification({
    userId: respondentId,
    type: "DISPUTE_OPENED",
    actorId: userId,
    entityType: "SALE",
    entityId: saleId,
  });
}

/** Timeouts cron : J+3 non-expédié → annulé/remboursé ; fin garantie 72 h → clôture auto. */
export async function processSaleTimeouts(): Promise<{ notShipped: number; completed: number }> {
  const now = new Date();
  let notShipped = 0;
  let completed = 0;

  // J+3 : envoi jamais créé/expédié → annulation + remboursement.
  const overdue = await prisma.shipment.findMany({
    where: { status: "PENDING", notShipDeadline: { lte: now }, saleId: { not: null } },
    select: { id: true, saleId: true },
  });
  for (const s of overdue) {
    if (!s.saleId) continue;
    const sale = await prisma.sale.findUnique({ where: { id: s.saleId } });
    if (!sale || sale.status !== "AWAITING_SHIPMENT") continue;

    const payment = await prisma.payment.findFirst({ where: { saleId: s.saleId, kind: "PURCHASE" } });
    if (payment) await refundPurchase(payment.id);

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: s.id }, data: { status: "LOST" } });
      await tx.sale.update({ where: { id: s.saleId! }, data: { status: "NOT_SHIPPED_CANCELLED" } });
      await tx.listing.update({ where: { id: sale.listingId }, data: { status: "ACTIVE" } });
      await tx.transactionEvent.create({
        data: { entityType: "SALE", entityId: s.saleId!, fromStatus: "AWAITING_SHIPMENT", toStatus: "NOT_SHIPPED_CANCELLED", event: "NOT_SHIPPED_TIMEOUT" },
      });
    });
    notShipped += 1;
  }

  // Fin de fenêtre garantie 72 h → clôture automatique (hors litige).
  const windows = await prisma.sale.findMany({
    where: { status: "DELIVERED_WINDOW" },
    include: { shipment: true, listing: true, payments: { where: { kind: "PURCHASE" } } },
  });
  for (const sale of windows) {
    if (!sale.shipment?.guaranteeEndsAt || sale.shipment.guaranteeEndsAt > now) continue;

    const payment = sale.payments[0];
    if (payment) await releaseToSeller(payment.id);

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: sale.id }, data: { status: "COMPLETED", completedAt: now } });
      await reallocateCollection(tx, sale.sellerId, sale.buyerId, sale.listing.variantId, sale.listing.condition);
      await tx.transactionEvent.create({
        data: { entityType: "SALE", entityId: sale.id, fromStatus: "DELIVERED_WINDOW", toStatus: "COMPLETED", event: "GUARANTEE_EXPIRED" },
      });
    });
    completed += 1;
    await evaluateUserBadgesForUsers([sale.sellerId, sale.buyerId]);
  }

  return { notShipped, completed };
}
