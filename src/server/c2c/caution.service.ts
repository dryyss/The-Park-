import "server-only";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/env";
import { dispatchNotification } from "@/server/notification/notification.mutations";

/** Estime la valeur des cartes reçues par un membre dans un échange. */
export async function estimateExchangeReceiveValue(exchangeId: string, userId: string): Promise<number> {
  const ex = await prisma.exchange.findFirst({
    where: { id: exchangeId, OR: [{ initiatorId: userId }, { recipientId: userId }] },
    include: {
      items: {
        include: { variant: { include: { card: { select: { quoteValue: true } } } } },
      },
    },
  });
  if (!ex) return 0;

  const isInitiator = ex.initiatorId === userId;
  return ex.items
    .filter((i) => i.fromInitiator !== isInitiator)
    .reduce((sum, i) => sum + Number(i.variant.card.quoteValue) * i.quantity, 0);
}

/**
 * Crée une pré-autorisation Stripe (capture manuelle) pour la caution C2C.
 * Sans Stripe configuré : enregistre un paiement AUTHORIZED en base (mode dev).
 */
export async function authorizeExchangeCaution(
  exchangeId: string,
  userId: string,
  shipmentId?: string,
): Promise<{ paymentId: string; clientSecret: string | null }> {
  const amount = await estimateExchangeReceiveValue(exchangeId, userId);
  if (amount <= 0) throw new Error("ZERO_CAUTION");

  const existing = await prisma.payment.findFirst({
    where: { exchangeId, userId, kind: "CAUTION", status: { in: ["AUTHORIZED", "REQUIRES_PAYMENT"] } },
  });
  if (existing?.status === "AUTHORIZED") {
    return { paymentId: existing.id, clientSecret: null };
  }

  let stripePaymentIntentId: string | null = null;
  let clientSecret: string | null = null;

  if (isStripeConfigured()) {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "eur",
      capture_method: "manual",
      metadata: { exchangeId, userId, kind: "CAUTION" },
    });
    stripePaymentIntentId = pi.id;
    clientSecret = pi.client_secret;
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      kind: "CAUTION",
      status: isStripeConfigured() ? "REQUIRES_PAYMENT" : "AUTHORIZED",
      amount,
      exchangeId,
      shipmentId: shipmentId ?? null,
      stripePaymentIntentId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await dispatchNotification({
    userId,
    type: "PAYMENT_AUTHORIZED",
    entityType: "PAYMENT",
    entityId: payment.id,
    payload: { amount: amount.toFixed(2) },
  });

  return { paymentId: payment.id, clientSecret };
}

/** Confirme l'autorisation après succès Stripe (webhook ou retour client). */
export async function markCautionAuthorized(paymentId: string, stripePaymentIntentId: string): Promise<void> {
  await prisma.payment.updateMany({
    where: { id: paymentId, stripePaymentIntentId },
    data: { status: "AUTHORIZED" },
  });
}
