import "server-only";
import { getAppBaseUrl, isStripeConfigured } from "@/lib/env";
import { assertStripeMinAmountEur, getStripe } from "@/lib/stripe";
import { quoteWalletTopUp, WALLET_MIN_TOP_UP_EUR } from "@/lib/wallet";
import { creditWalletFromTopUp } from "@/server/wallet/wallet.service";

export async function createWalletTopUpCheckoutSession(
  userId: string,
  locale: string,
  creditEur: number,
): Promise<string> {
  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");
  if (creditEur < WALLET_MIN_TOP_UP_EUR) throw new Error("TOP_UP_TOO_LOW");

  const quote = quoteWalletTopUp(creditEur);
  assertStripeMinAmountEur(quote.totalChargeEur);

  const stripe = getStripe();
  const baseUrl = getAppBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: locale === "ja" ? "ja" : locale === "en" ? "en" : "fr",
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(quote.totalChargeEur * 100),
          product_data: {
            name: "Crédits The Park",
            description: `${quote.creditEur.toFixed(2)} € de crédit (+ ${quote.feeEur.toFixed(2)} € frais)`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: "WALLET_TOP_UP",
      userId,
      creditEur: String(quote.creditEur),
      feeEur: String(quote.feeEur),
    },
    success_url: `${baseUrl}/${locale}/portefeuille?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${locale}/portefeuille?cancelled=1`,
    client_reference_id: userId,
  });

  if (!session.url) throw new Error("STRIPE_SESSION_URL_MISSING");
  return session.url;
}

export async function fulfillWalletTopUpFromStripeSession(sessionId: string): Promise<void> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.kind !== "WALLET_TOP_UP") return;
  if (session.payment_status !== "paid") return;

  const userId = session.metadata.userId;
  const creditEur = Number(session.metadata.creditEur);
  const feeEur = Number(session.metadata.feeEur);
  if (!userId || !Number.isFinite(creditEur)) throw new Error("INVALID_TOP_UP_METADATA");

  await creditWalletFromTopUp({
    userId,
    creditEur,
    feeEur: Number.isFinite(feeEur) ? feeEur : 0,
    stripeCheckoutSessionId: session.id,
  });

  // Le 1er dépôt qualifie un éventuel parrainage → bonus au parrain et au filleul.
  const { rewardReferralIfEligible } = await import("@/server/referral/referral.service");
  await rewardReferralIfEligible(userId).catch((err) => {
    console.error("[referral] reward on top-up failed", err);
  });
}
