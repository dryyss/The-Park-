import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { fulfillOrderFromStripeSession } from "@/server/checkout/checkout.service";
import { fulfillSaleFromStripeSession } from "@/server/sale/sale-checkout.service";
import { syncConnectAccountByStripeId } from "@/server/wallet/wallet-connect.service";

export const runtime = "nodejs";

/**
 * Verrou d'idempotence : l'insertion de l'id d'évènement Stripe sert de garde.
 * Un doublon (rejeu, double livraison Stripe) viole la PK → on ignore sans
 * retraiter. Retourne `true` si l'évènement est nouveau et doit être traité.
 */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({
      data: { id: event.id, provider: "stripe", type: event.type },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET manquant");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature absente" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature invalide", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  // Idempotence : ne traiter chaque évènement qu'une fois (Stripe peut rejouer).
  let fresh: boolean;
  try {
    fresh = await claimEvent(event);
  } catch (err) {
    console.error("[stripe webhook] verrou idempotence échoué", err);
    return NextResponse.json({ error: "Verrou indisponible" }, { status: 503 });
  }
  if (!fresh) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" && session.id) {
        if (session.metadata?.kind === "PURCHASE" && session.metadata?.saleId) {
          await fulfillSaleFromStripeSession(session.id);
        } else if (session.metadata?.kind === "MARKETPLACE_CART" && session.metadata?.checkoutId) {
          const { fulfillMarketplaceCheckoutFromStripeSession } = await import(
            "@/server/marketplace-cart/marketplace-cart-checkout.service"
          );
          await fulfillMarketplaceCheckoutFromStripeSession(session.id);
        } else if (session.metadata?.kind === "WALLET_TOP_UP") {
          const { fulfillWalletTopUpFromStripeSession } = await import("@/server/wallet/wallet-topup.service");
          await fulfillWalletTopUpFromStripeSession(session.id);
        } else if (session.metadata?.orderId) {
          await fulfillOrderFromStripeSession(session.id);
        }
      }
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      if (account.id) await syncConnectAccountByStripeId(account.id);
    }

    if (event.type === "payment_intent.amount_capturable_updated") {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === "CAUTION" && pi.status === "requires_capture") {
        const { markCautionAuthorized } = await import("@/server/c2c/caution.service");
        await markCautionAuthorized(pi.id);
      }
    }

    if (event.type === "payment_intent.canceled") {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === "CAUTION") {
        const { markCautionCancelled } = await import("@/server/c2c/caution.service");
        await markCautionCancelled(pi.id);
      }
    }
  } catch (err) {
    console.error("[stripe webhook] traitement", event.type, err);
    // Libérer le verrou pour que le rejeu Stripe puisse retraiter l'évènement.
    await prisma.processedWebhookEvent
      .delete({ where: { id: event.id } })
      .catch(() => {});
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
