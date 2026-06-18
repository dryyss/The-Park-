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
 * Flux wallet : débit acheteur à l'achat, crédit vendeur à la clôture, remboursement wallet si annulé.
 * Flux legacy Stripe PI : capture + virement Connect si dispo.
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

/** Libère les fonds vers le vendeur (wallet interne ou virement Connect). Idempotent. */
export async function releaseToSeller(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { payee: true } });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.status === "RELEASED") return;

  if (payment.status !== "CAPTURED") await capturePurchase(paymentId);

  const net = Number(payment.amount) - Number(payment.applicationFee);
  const walletFunded = payment.saleId ? await isWalletFundedSale(payment.saleId) : false;

  if (walletFunded && payment.payeeId && payment.saleId && net > 0) {
    await creditWalletForSalePayout({
      userId: payment.payeeId,
      saleId: payment.saleId,
      amountEur: net,
    });
  }

  let stripeTransferId: string | null = null;
  if (
    !walletFunded &&
    isStripeConfigured() &&
    payment.payee?.stripeConnectAccountId &&
    payment.payee.connectPayoutsEnabled
  ) {
    if (net > 0) {
      const transfer = await getStripe().transfers.create({
        amount: Math.round(net * 100),
        currency: "eur",
        destination: payment.payee.stripeConnectAccountId,
        metadata: { paymentId },
      });
      stripeTransferId = transfer.id;
    }
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "RELEASED", releasedAt: new Date(), ...(stripeTransferId ? { stripeTransferId } : {}) },
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
