import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getViewerCart } from "@/server/cart/cart.service";
import { computeShopShipping, getShopShippingConfig } from "@/server/platform/platform.service";

export interface ShippingInput {
  fullName: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  country?: string;
}

async function resolveShipping(subtotalRaw: number): Promise<{ cost: number; carrier: string }> {
  const [cost, cfg] = await Promise.all([computeShopShipping(subtotalRaw), getShopShippingConfig()]);
  return { cost, carrier: cfg.defaultCarrier };
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

  const { cost: shippingCost, carrier } = await resolveShipping(cart.subtotalRaw);
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
        product_data: { name: "Livraison Colissimo" },
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

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "PAID" },
    });

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
  });

  return order;
}
