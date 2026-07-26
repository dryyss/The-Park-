import "server-only";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/env";
import {
  creditWalletForSalePayout,
  creditWalletForSaleRefund,
  isWalletFundedSale,
} from "@/server/wallet/wallet.service";

/**
 * Couche paiement escrow d'une vente marketplace (Payment kind=PURCHASE).
 * Débit acheteur à l'achat (wallet) ou encaissement Stripe (carte), crédit des gains
 * vendeur dans son portefeuille à la clôture, remboursement si annulé.
 * Le versement réel au vendeur passe ensuite par une demande de retrait
 * (virement/PayPal manuel ou Stripe Connect) — jamais directement ici.
 * Sans Stripe configuré : tout est simulé en base (mode dev).
 */

/** Capture définitive des fonds (escrow plateforme). Idempotent. */
export async function capturePurchase(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.status === "CAPTURED" || payment.status === "RELEASED") return;

  if (isStripeConfigured() && payment.stripePaymentIntentId) {
    try {
      await getStripe().paymentIntents.capture(payment.stripePaymentIntentId);
    } catch {
      // déjà capturé / non capturable : on aligne la base ci-dessous
    }
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "CAPTURED", capturedAmount: payment.amount, capturedAt: new Date() },
  });
}

/** Libère les gains vers le portefeuille du vendeur. Idempotent. */
export async function releaseToSeller(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.status === "RELEASED") return;

  if (payment.status !== "CAPTURED") await capturePurchase(paymentId);

  const net = Number(payment.amount) - Number(payment.applicationFee);

  // Les gains atterrissent toujours dans le portefeuille interne, que l'acheteur ait
  // payé en crédits ou par carte : c'est `earnedBalance` qui alimente les retraits.
  if (payment.payeeId && payment.saleId && net > 0) {
    await creditWalletForSalePayout({
      userId: payment.payeeId,
      saleId: payment.saleId,
      amountEur: net,
    });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
}

/** Rembourse l'acheteur (wallet interne ou annulation PI Stripe). Idempotent. */
export async function refundPurchase(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.status === "REFUNDED" || payment.status === "CANCELLED") return;

  const onlyAuthorized = payment.status === "AUTHORIZED" || payment.status === "REQUIRES_PAYMENT";
  const walletFunded = payment.saleId ? await isWalletFundedSale(payment.saleId) : false;

  if (walletFunded && payment.userId && payment.saleId) {
    await creditWalletForSaleRefund({
      userId: payment.userId,
      saleId: payment.saleId,
      amountEur: Number(payment.amount),
    });
  } else if (isStripeConfigured() && payment.stripePaymentIntentId) {
    try {
      if (onlyAuthorized) {
        await getStripe().paymentIntents.cancel(payment.stripePaymentIntentId);
      } else {
        await getStripe().refunds.create({ payment_intent: payment.stripePaymentIntentId });
      }
    } catch {
      // déjà annulé / remboursé
    }
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: onlyAuthorized ? "CANCELLED" : "REFUNDED" },
  });
}
