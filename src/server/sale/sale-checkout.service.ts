import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { cardImage } from "@/lib/rarity";
import { markSalePaid } from "@/server/sale/sale-lifecycle.service";

/** Crée une session Stripe Checkout pour finaliser une vente marketplace (capture manuelle). */
export async function createSaleCheckoutSession(
  saleId: string,
  locale: string,
  buyerId: string,
): Promise<string> {
  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, buyerId, status: "PENDING_PAYMENT" },
    include: {
      listing: { include: { variant: { include: { card: true } } } },
      payments: { where: { kind: "PURCHASE" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!sale) throw new Error("SALE_NOT_FOUND");

  const payment = sale.payments[0];
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");

  const card = sale.listing.variant.card;
  const total = Number(sale.price) + Number(sale.serviceFee);
  const stripe = getStripe();
  const baseUrl = getAppBaseUrl();
  const image = card.imageUrl ? cardImage(card.imageUrl) : null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: locale === "ja" ? "ja" : locale === "en" ? "en" : "fr",
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(total * 100),
          product_data: {
            name: card.name,
            description: `Marketplace · #${String(card.number).padStart(2, "0")}`,
            ...(image ? { images: [`${baseUrl}${image}`] } : {}),
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      capture_method: "manual",
      metadata: { saleId, paymentId: payment.id, kind: "PURCHASE" },
    },
    metadata: { saleId, paymentId: payment.id, kind: "PURCHASE" },
    success_url: `${baseUrl}/${locale}/marketplace/achat/${saleId}?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${locale}/marketplace?cancelled=1`,
    client_reference_id: saleId,
  });

  if (!session.url) throw new Error("STRIPE_SESSION_URL_MISSING");
  return session.url;
}

/** Finalise une vente après retour Stripe Checkout ou webhook. Idempotent via markSalePaid. */
export async function fulfillSaleFromStripeSession(sessionId: string): Promise<void> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });

  const saleId = session.metadata?.saleId;
  if (!saleId) throw new Error("MISSING_SALE_ID");

  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { status: true } });
  if (!sale) throw new Error("SALE_NOT_FOUND");
  if (sale.status !== "PENDING_PAYMENT") return;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  const paymentId = session.metadata?.paymentId;
  if (paymentId && paymentIntentId) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { stripePaymentIntentId: paymentIntentId },
    });
  }

  await markSalePaid(saleId);
}
