import "server-only";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/env";
import { markSalePaid } from "@/server/sale/sale-lifecycle.service";

/** Commission plateforme sur une vente C2C (0 % pour l'instant). */
export const SALE_SERVICE_FEE_PCT = 0;

/** Statuts d'une vente encore « vivante » (bloquent une 2ᵉ vente sur la même annonce). */
export const ACTIVE_SALE_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "DELIVERED_WINDOW",
  "DELIVERED",
  "DISPUTED",
  "GUARANTEE_SUSPENDED",
] as const;

/**
 * Crée une vente sécurisée à partir d'une annonce ACTIVE (type SELL / SELL_OR_TRADE).
 * Crée Sale (PENDING_PAYMENT) + Payment (PURCHASE) + Conversation dédiée, puis
 * la pré-autorisation Stripe (capture manuelle). Sans Stripe : la vente passe
 * directement à PAID (mode dev). Le stock du vendeur est déjà réservé par l'annonce.
 */
export async function createSaleFromListing(
  buyerId: string,
  listingId: string,
): Promise<{ saleId: string; clientSecret: string | null }> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "ACTIVE", type: { in: ["SELL", "SELL_OR_TRADE"] } },
  });
  if (!listing) throw new Error("LISTING_UNAVAILABLE");
  if (listing.price == null) throw new Error("NO_PRICE");
  if (listing.sellerId === buyerId) throw new Error("SELF_PURCHASE");

  // Anti double-vente : pas de vente déjà en cours sur cette annonce.
  const existing = await prisma.sale.findFirst({
    where: { listingId, status: { in: [...ACTIVE_SALE_STATUSES] } },
    select: { id: true, buyerId: true, status: true },
  });
  if (existing) {
    if (existing.buyerId === buyerId && existing.status === "PENDING_PAYMENT") {
      return { saleId: existing.id, clientSecret: null };
    }
    throw new Error("ALREADY_SOLD");
  }

  const price = Number(listing.price);
  const serviceFee = Math.round(price * SALE_SERVICE_FEE_PCT) / 100;
  const total = price + serviceFee;

  const { saleId, paymentId } = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        status: "PENDING_PAYMENT",
        price,
        serviceFee,
        shippingMode: listing.shippingMode,
        shippingCost: 0,
      },
    });

    const payment = await tx.payment.create({
      data: {
        userId: buyerId,
        payeeId: listing.sellerId,
        kind: "PURCHASE",
        status: "REQUIRES_PAYMENT",
        amount: total,
        applicationFee: serviceFee,
        saleId: sale.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Conversation dédiée à la vente (distincte du fil de contact générique).
    await tx.conversation.create({
      data: {
        context: "SALE",
        saleId: sale.id,
        participants: { create: [{ userId: buyerId }, { userId: listing.sellerId }] },
      },
    });

    await tx.transactionEvent.create({
      data: {
        entityType: "SALE",
        entityId: sale.id,
        toStatus: "PENDING_PAYMENT",
        event: "SALE_CREATED",
        actorId: buyerId,
        metadata: { listingId, paymentId: payment.id },
      },
    });

    return { saleId: sale.id, paymentId: payment.id };
  });

  if (isStripeConfigured()) {
    return { saleId, clientSecret: null };
  }

  // Mode dev sans Stripe : paiement simulé, vente confirmée immédiatement.
  await markSalePaid(saleId);
  return { saleId, clientSecret: null };
}
