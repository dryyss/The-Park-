import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, isStripeConfigured } from "@/lib/env";
import { assertStripeMinAmountEur, getStripe, stripePublicImageUrl } from "@/lib/stripe";
import { cardImage } from "@/lib/rarity";
import { roundEur } from "@/lib/wallet";
import { formatPrice } from "@/lib/format";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import { markSaleFailed, markSalePaid } from "@/server/sale/sale-lifecycle.service";
import { creditWalletForSalePayout, debitWalletForSale, getWalletSpendableBalanceEur, isWalletFundedSale } from "@/server/wallet/wallet.service";
import {
  getViewerMarketplaceCart,
  removeMarketplaceCartItemByListing,
  type MarketplaceCartLine,
} from "@/server/marketplace-cart/marketplace-cart.service";
import { issueMarketplaceInvoices } from "@/server/marketplace-cart/marketplace-invoice.service";

export interface MarketplaceRecapLine extends MarketplaceCartLine {
  sellerId: string;
}

export interface MarketplaceRecapSummary {
  lines: MarketplaceRecapLine[];
  itemCount: number;
  subtotal: string;
  subtotalRaw: number;
}

async function generateCheckoutNumber(): Promise<string> {
  const prefix = `MKP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let i = 0; i < 8; i++) {
    const suffix = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const checkoutNumber = `${prefix}-${suffix}`;
    const exists = await prisma.marketplaceCheckout.findUnique({ where: { checkoutNumber }, select: { id: true } });
    if (!exists) return checkoutNumber;
  }
  throw new Error("CHECKOUT_NUMBER_EXHAUSTED");
}

/** Filtre les lignes du panier (toutes si cartItemIds vide). */
export async function getMarketplaceRecap(
  userId: string,
  cartItemIds?: string[],
): Promise<MarketplaceRecapSummary> {
  const cart = await getViewerMarketplaceCart(userId);
  const idSet = cartItemIds?.length ? new Set(cartItemIds) : null;
  const lines = cart.lines.filter((line) => !idSet || idSet.has(line.id));

  const listingIds = lines.map((l) => l.listingId);
  const listings =
    listingIds.length > 0
      ? await prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: { id: true, sellerId: true },
        })
      : [];
  const sellerByListing = new Map(listings.map((l) => [l.id, l.sellerId]));

  let subtotalRaw = 0;
  const recapLines: MarketplaceRecapLine[] = lines.map((line) => {
    subtotalRaw += line.priceRaw;
    return { ...line, sellerId: sellerByListing.get(line.listingId) ?? "" };
  });

  return {
    lines: recapLines,
    itemCount: recapLines.length,
    subtotal: formatPrice(subtotalRaw),
    subtotalRaw: roundEur(subtotalRaw),
  };
}

async function cancelPendingCheckout(checkoutId: string): Promise<void> {
  const checkout = await prisma.marketplaceCheckout.findUnique({
    where: { id: checkoutId },
    include: { lines: true },
  });
  if (!checkout || checkout.status !== "PENDING") return;

  for (const line of checkout.lines) {
    await markSaleFailed(line.saleId);
  }

  await prisma.marketplaceCheckout.update({
    where: { id: checkoutId },
    data: { status: "CANCELLED" },
  });
}

/** Prépare un checkout groupé et renvoie l'URL Stripe (ou fulfillment direct en dev). */
export async function startMarketplaceCartStripeCheckout(input: {
  buyerId: string;
  locale: string;
  cartItemIds?: string[];
}): Promise<{ checkoutId: string; url: string }> {
  const recap = await getMarketplaceRecap(input.buyerId, input.cartItemIds);
  if (recap.lines.length === 0) throw new Error("EMPTY_CART");
  assertStripeMinAmountEur(recap.subtotalRaw);

  const checkoutNumber = await generateCheckoutNumber();
  const checkout = await prisma.marketplaceCheckout.create({
    data: {
      checkoutNumber,
      buyerId: input.buyerId,
      subtotal: recap.subtotalRaw,
      total: recap.subtotalRaw,
    },
  });

  const saleLines: { line: MarketplaceRecapLine; saleId: string; paymentId: string }[] = [];

  try {
    for (const line of recap.lines) {
      const { saleId } = await createSaleFromListing(input.buyerId, line.listingId);
      const payment = await prisma.payment.findFirst({
        where: { saleId, kind: "PURCHASE" },
        select: { id: true },
      });
      if (!payment) throw new Error("PAYMENT_NOT_FOUND");

      await prisma.marketplaceCheckoutLine.create({
        data: {
          checkoutId: checkout.id,
          saleId,
          cartItemId: line.id,
          listingId: line.listingId,
          sellerId: line.sellerId,
          cardName: line.name,
          unitPrice: line.priceRaw,
        },
      });

      saleLines.push({ line, saleId, paymentId: payment.id });
    }
  } catch (err) {
    await cancelPendingCheckout(checkout.id);
    throw err;
  }

  if (!isStripeConfigured()) {
    await fulfillMarketplaceCheckout(checkout.id, null);
    const baseUrl = getAppBaseUrl();
    return {
      checkoutId: checkout.id,
      url: `${baseUrl}/${input.locale}/marketplace/panier/confirmation/${checkout.id}?success=1`,
    };
  }

  const stripe = getStripe();
  const baseUrl = getAppBaseUrl();
  const itemsParam = input.cartItemIds?.length ? input.cartItemIds.join(",") : "all";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: input.locale === "ja" ? "ja" : input.locale === "en" ? "en" : "fr",
    line_items: recap.lines.map((line) => {
      const image = stripePublicImageUrl(baseUrl, line.image ?? undefined);
      return {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(line.priceRaw * 100),
          product_data: {
            name: line.name,
            description: `${line.versionLabel} · ${line.sellerName}`,
            ...(image ? { images: [image] } : {}),
          },
        },
        quantity: 1,
      };
    }),
    shipping_address_collection: {
      allowed_countries: ["FR", "BE", "CH", "LU", "MC", "AD", "GP", "MQ", "GF", "RE", "YT"],
    },
    metadata: {
      kind: "MARKETPLACE_CART",
      checkoutId: checkout.id,
      buyerId: input.buyerId,
    },
    success_url: `${baseUrl}/${input.locale}/marketplace/panier/confirmation/${checkout.id}?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${input.locale}/marketplace/panier/recap?cancelled=1&items=${encodeURIComponent(itemsParam)}&checkoutId=${checkout.id}`,
    client_reference_id: checkout.id,
  });

  if (!session.url) {
    await cancelPendingCheckout(checkout.id);
    throw new Error("STRIPE_SESSION_URL_MISSING");
  }

  await prisma.marketplaceCheckout.update({
    where: { id: checkout.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return { checkoutId: checkout.id, url: session.url };
}

/** Finalise le checkout après paiement Stripe (ou mode dev). Idempotent. */
export async function fulfillMarketplaceCheckout(checkoutId: string, stripeSessionId: string | null): Promise<void> {
  const checkout = await prisma.marketplaceCheckout.findUnique({
    where: { id: checkoutId },
    include: {
      buyer: { select: { id: true, email: true, displayName: true } },
      lines: {
        include: {
          sale: {
            include: {
              payments: { where: { kind: "PURCHASE" }, take: 1 },
              seller: { select: { id: true, email: true, displayName: true } },
            },
          },
        },
      },
    },
  });
  if (!checkout) throw new Error("CHECKOUT_NOT_FOUND");
  if (checkout.status === "PAID") return;

  let paymentIntentId: string | null = null;
  if (stripeSessionId && isStripeConfigured()) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId, { expand: ["payment_intent"] });
    if (session.payment_status !== "paid") throw new Error("PAYMENT_NOT_COMPLETED");
    paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  }

  for (const line of checkout.lines) {
    await markSalePaid(line.saleId);

    const payment = line.sale.payments[0];
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
          status: "CAPTURED",
          capturedAmount: payment.amount,
          capturedAt: new Date(),
        },
      });
    }

    const net = roundEur(Number(line.sale.price) - Number(line.sale.serviceFee));
    // Crédite le vendeur uniquement si le paiement était en wallet (pas double-credit Stripe).
    if (net > 0 && (await isWalletFundedSale(line.saleId))) {
      await creditWalletForSalePayout({
        userId: line.sellerId,
        saleId: line.saleId,
        amountEur: net,
      });
    }

    if (line.cartItemId) {
      await removeMarketplaceCartItemByListing(checkout.buyerId, line.listingId);
    }
  }

  await issueMarketplaceInvoices({
    checkoutId: checkout.id,
    checkoutNumber: checkout.checkoutNumber,
    buyer: checkout.buyer,
    lines: checkout.lines.map((line) => ({
      saleId: line.saleId,
      sellerId: line.sellerId,
      seller: line.sale.seller,
      cardName: line.cardName,
      unitPrice: Number(line.unitPrice),
    })),
    paymentIntentId,
  });

  await prisma.marketplaceCheckout.update({
    where: { id: checkoutId },
    data: { status: "PAID", paidAt: new Date() },
  });
}

/**
 * Paiement direct depuis le portefeuille (sans Stripe).
 * Débite le wallet de l'acheteur puis finalise le checkout.
 */
export async function startAndFulfillMarketplaceCheckoutWithWallet(input: {
  buyerId: string;
  cartItemIds?: string[];
}): Promise<{ checkoutId: string }> {
  const recap = await getMarketplaceRecap(input.buyerId, input.cartItemIds);
  if (recap.lines.length === 0) throw new Error("EMPTY_CART");

  const walletBalance = await getWalletSpendableBalanceEur(input.buyerId);
  if (walletBalance < recap.subtotalRaw) throw new Error("INSUFFICIENT_WALLET");

  // Annule les checkouts Stripe en attente (ex : utilisateur ayant fermé l'onglet Stripe
  // sans passer par l'URL d'annulation) pour éviter le conflit de clé unique sur saleId.
  const stalePending = await prisma.marketplaceCheckout.findMany({
    where: { buyerId: input.buyerId, status: "PENDING" },
    select: { id: true },
  });
  for (const pc of stalePending) {
    await cancelPendingCheckout(pc.id);
  }

  const checkoutNumber = await generateCheckoutNumber();
  const checkout = await prisma.marketplaceCheckout.create({
    data: {
      checkoutNumber,
      buyerId: input.buyerId,
      subtotal: recap.subtotalRaw,
      total: recap.subtotalRaw,
    },
  });

  try {
    for (const line of recap.lines) {
      const { saleId } = await createSaleFromListing(input.buyerId, line.listingId);
      const payment = await prisma.payment.findFirst({
        where: { saleId, kind: "PURCHASE" },
        select: { id: true },
      });
      if (!payment) throw new Error("PAYMENT_NOT_FOUND");

      await prisma.marketplaceCheckoutLine.create({
        data: {
          checkoutId: checkout.id,
          saleId,
          cartItemId: line.id,
          listingId: line.listingId,
          sellerId: line.sellerId,
          cardName: line.name,
          unitPrice: line.priceRaw,
        },
      });

      // Débiter le wallet pour cette ligne avant de finaliser
      await debitWalletForSale({
        userId: input.buyerId,
        saleId,
        amountEur: line.priceRaw,
      });
    }
  } catch (err) {
    await cancelPendingCheckout(checkout.id);
    throw err;
  }

  await fulfillMarketplaceCheckout(checkout.id, null);
  return { checkoutId: checkout.id };
}

export async function fulfillMarketplaceCheckoutFromStripeSession(sessionId: string): Promise<void> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const checkoutId = session.metadata?.checkoutId;
  if (!checkoutId || session.metadata?.kind !== "MARKETPLACE_CART") {
    throw new Error("INVALID_CHECKOUT_SESSION");
  }
  await fulfillMarketplaceCheckout(checkoutId, sessionId);
}

export async function cancelMarketplaceCheckoutById(checkoutId: string, buyerId: string): Promise<void> {
  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: { id: checkoutId, buyerId, status: "PENDING" },
    select: { id: true },
  });
  if (!checkout) return;
  await cancelPendingCheckout(checkout.id);
}

export async function getMarketplaceCheckoutForBuyer(checkoutId: string, buyerId: string) {
  return prisma.marketplaceCheckout.findFirst({
    where: { id: checkoutId, buyerId },
    include: {
      invoices: { orderBy: { createdAt: "asc" } },
      lines: { orderBy: { id: "asc" } },
    },
  });
}

export async function getBuyerMarketplaceCheckoutHistory(buyerId: string, limit = 20) {
  return prisma.marketplaceCheckout.findMany({
    where: { buyerId, status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: limit,
    include: {
      lines: true,
      invoices: { where: { recipient: "BUYER" }, take: 1 },
    },
  });
}
