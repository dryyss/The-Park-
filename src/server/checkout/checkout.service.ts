import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getViewerCart } from "@/server/cart/cart.service";
import { getShopShippingConfig } from "@/server/platform/platform.service";
import {
  dispatchNotificationToShopStaff,
  localeFromLanguage,
} from "@/server/notification/notification.mutations";
import { buildShopOrderConfirmationEmail } from "@/server/notification/transactional-emails";
import { sendTransactionalEmail } from "@/lib/resend";
import { formatPrice } from "@/lib/format";
import type { ShippingMode } from "@/generated/prisma/client";
import {
  boutiqueCarrierLabel,
  DEFAULT_BOUTIQUE_SHIPPING_MODE,
  isBoutiqueShippingMode,
  shippingFeeEur,
} from "@/lib/shipping";

export interface ShippingInput {
  fullName: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  country?: string;
  shippingMode?: string;
}

/**
 * Coût de livraison boutique : le mode choisi par l'acheteur détermine les frais,
 * mais la franchise « offert dès X€ » de la config reste prioritaire.
 * Le coût est toujours recalculé ici (jamais transmis par le client).
 */
async function resolveShipping(
  subtotalRaw: number,
  mode: ShippingMode,
): Promise<{ cost: number; carrier: string }> {
  const cfg = await getShopShippingConfig();
  const cost = subtotalRaw > 0 && subtotalRaw < cfg.freeShippingMin ? shippingFeeEur(mode) : 0;
  return { cost, carrier: boutiqueCarrierLabel(mode) };
}

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.floor(10000 + Math.random() * 89999);
    const orderNumber = `TP-${year}-${suffix}`;
    const exists = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!exists) return orderNumber;
  }
  throw new Error("ORDER_NUMBER_COLLISION");
}

export async function createCheckoutFromCart(userId: string, locale: string, shipping: ShippingInput) {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }

  const cart = await getViewerCart(userId);
  if (cart.lines.length === 0) {
    throw new Error("EMPTY_CART");
  }
  if (cart.lines.some((line) => !line.inStock)) {
    throw new Error("OUT_OF_STOCK");
  }

  const mode: ShippingMode =
    shipping.shippingMode && isBoutiqueShippingMode(shipping.shippingMode)
      ? shipping.shippingMode
      : DEFAULT_BOUTIQUE_SHIPPING_MODE;
  const { cost: shippingCost, carrier } = await resolveShipping(cart.subtotalRaw, mode);
  const totalRaw = cart.subtotalRaw + shippingCost;
  const orderNumber = await generateOrderNumber();
  const country = shipping.country?.trim() || "FR";

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        status: "PENDING",
        subtotal: cart.subtotalRaw,
        shippingCost,
        total: totalRaw,
        shippingName: shipping.fullName.trim(),
        shippingLine1: shipping.address.trim(),
        shippingZip: shipping.zip.trim(),
        shippingCity: shipping.city.trim(),
        shippingCountry: country,
        shippingMethod: carrier,
        items: {
          create: cart.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPriceRaw,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    await tx.payment.create({
      data: {
        userId,
        kind: "STORE_ORDER",
        status: "REQUIRES_PAYMENT",
        amount: totalRaw,
        orderId: created.id,
      },
    });

    return created;
  });

  const stripe = getStripe();
  const baseUrl = getAppBaseUrl();

  const lineItems = order.items.map((item) => ({
    price_data: {
      currency: "eur",
      unit_amount: Math.round(Number(item.unitPrice) * 100),
      product_data: {
        name: item.product.name,
        ...(item.product.images[0] ? { images: [`${baseUrl}${item.product.images[0]}`] } : {}),
      },
    },
    quantity: item.quantity,
  }));

  if (shippingCost > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        unit_amount: Math.round(shippingCost * 100),
        product_data: { name: `Livraison — ${carrier}` },
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: locale === "ja" ? "ja" : locale === "en" ? "en" : "fr",
    line_items: lineItems,
    metadata: {
      orderId: order.id,
      userId,
      orderNumber: order.orderNumber,
    },
    success_url: `${baseUrl}/${locale}/boutique/commandes/${order.id}?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${locale}/boutique/checkout?cancelled=1`,
    client_reference_id: order.id,
  });

  if (!session.url) {
    throw new Error("STRIPE_SESSION_URL_MISSING");
  }

  return { url: session.url, orderId: order.id };
}

export async function fulfillOrderFromStripeSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    throw new Error("MISSING_ORDER_ID");
  }

  if (session.payment_status !== "paid") {
    throw new Error("PAYMENT_NOT_COMPLETED");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }
  if (order.status === "PAID") {
    return order;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  // Transition atomique PENDING→PAID : si un autre appel (webhook + page succès)
  // a déjà encaissé la commande, on ne rejoue ni le stock ni les notifications.
  const transitioned = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    if (claimed.count === 0) return false;

    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: {
          status: "CAPTURED",
          capturedAmount: order.total,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        },
      });
    }

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId: order.userId } });
    return true;
  });

  if (transitioned) {
    await notifyShopStaffOfPaidOrder(orderId);
    await sendOrderConfirmationEmail(orderId);
  }

  return order;
}

/**
 * Confirmation de commande à l'acheteur (récap articles, montants, adresse).
 * Best-effort : un échec d'envoi ne doit pas faire échouer l'encaissement.
 */
async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, displayName: true, language: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    });
    if (!order?.user?.email) return;

    const locale = localeFromLanguage(order.user.language);
    const { subject, html } = buildShopOrderConfirmationEmail({
      orderNumber: order.orderNumber,
      customerName: order.user.displayName,
      items: order.items.map((item) => ({
        name: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        lineTotal: formatPrice(Number(item.unitPrice) * item.quantity),
      })),
      subtotal: formatPrice(order.subtotal),
      shippingCost: formatPrice(order.shippingCost),
      total: formatPrice(order.total),
      shipping: {
        name: order.shippingName,
        line1: order.shippingLine1,
        zip: order.shippingZip,
        city: order.shippingCity,
        country: order.shippingCountry,
        method: order.shippingMethod,
      },
      orderUrl: `${getAppBaseUrl()}/${locale}/boutique/commandes/${order.id}`,
      locale,
    });

    await sendTransactionalEmail({ to: order.user.email, subject, html });
  } catch (err) {
    console.error("[checkout] order confirmation email failed", err);
  }
}

/**
 * Prévient le staff boutique (in-app + e-mail + web push) qu'une commande vient
 * d'être payée. Best-effort : un échec de notification ne doit jamais faire
 * échouer le webhook Stripe (sinon Stripe rejoue et la commande se re-traite).
 */
async function notifyShopStaffOfPaidOrder(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        userId: true,
        user: { select: { displayName: true, email: true } },
        items: { select: { quantity: true } },
      },
    });
    if (!order) return;

    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const buyer = order.user?.displayName ?? order.user?.email ?? "Un client";

    await dispatchNotificationToShopStaff({
      type: "SHOP_ORDER_PLACED",
      actorId: order.userId ?? undefined,
      entityType: "ORDER",
      entityId: order.id,
      payload: {
        orderNumber: order.orderNumber,
        buyer,
        total: Number(order.total).toFixed(2),
        itemCount: String(itemCount),
        orderUrl: `${getAppBaseUrl()}/fr/admin/commandes/${order.id}`,
      },
    });
  } catch (err) {
    console.error("[checkout] staff order notification failed", err);
  }
}
