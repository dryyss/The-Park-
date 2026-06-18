import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Montant minimum Stripe Checkout en EUR (50 centimes). */
export const STRIPE_MIN_EUR_CENTS = 50;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, { typescript: true });
  }
  return stripeClient;
}

export function assertStripeMinAmountEur(totalEur: number): void {
  if (Math.round(totalEur * 100) < STRIPE_MIN_EUR_CENTS) {
    throw new Error("STRIPE_MIN_AMOUNT");
  }
}

/** Stripe exige des images HTTPS publiques — on ignore localhost / http. */
export function stripePublicImageUrl(baseUrl: string, imagePath: string | null | undefined): string | undefined {
  if (!imagePath?.trim()) return undefined;
  const normalized = imagePath.startsWith("http")
    ? imagePath
    : `${baseUrl}${imagePath.startsWith("/") ? imagePath : `/uploads/${imagePath}`}`;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") return undefined;
    return normalized;
  } catch {
    return undefined;
  }
}

export function mapStripeCheckoutError(err: unknown): string {
  if (err instanceof Error) {
    if (
      err.message === "STRIPE_MIN_AMOUNT" ||
      err.message === "STRIPE_NOT_CONFIGURED" ||
      err.message === "STRIPE_SESSION_URL_MISSING" ||
      err.message === "SALE_NOT_FOUND" ||
      err.message === "PAYMENT_NOT_FOUND"
    ) {
      return err.message;
    }
  }
  if (err instanceof Stripe.errors.StripeError) {
    if (/must be at least|minimum/i.test(err.message)) return "STRIPE_MIN_AMOUNT";
    return "STRIPE_ERROR";
  }
  return "UNKNOWN";
}
