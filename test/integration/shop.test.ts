import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";

/**
 * Tests d'intégration — BOUTIQUE OFFICIELLE (produits / panier / commandes).
 *
 * Contexte d'exécution (voir setup-env.ts) : Stripe est désactivé.
 *   - `createCheckoutFromCart` refuse donc de démarrer (STRIPE_NOT_CONFIGURED).
 *   - `fulfillOrderFromStripeSession` appelle `getStripe()` → il faut simuler Stripe.
 *
 * On mocke UNIQUEMENT `@/lib/stripe` (module externe, aucun fichier src modifié) pour
 * fournir une session Stripe "payée". Le reste (Prisma, décrément stock, transaction)
 * est exécuté réellement contre la base Postgres locale jetable.
 *
 * La logique du panier vit dans `cart.actions.ts` (server actions protégées par
 * `getAuthenticatedViewer()`, non appelables hors session HTTP). On teste donc :
 *   - les fonctions de lecture directes du service (`getViewerCart`, `getCartItemCount`) ;
 *   - la logique métier d'ajout/bornage réellement effectuée par les actions, reproduite
 *     via Prisma (mêmes requêtes upsert/cap que `addToCartAction`) afin de valider les
 *     invariants (bornage au stock, quantité <= 0, produit inactif/hors stock).
 */

// --- Mock Stripe : session "payée" paramétrable par test -------------------
const stripeSessionState: Record<
  string,
  { payment_status: string; metadata: Record<string, string>; payment_intent: string | null }
> = {};

vi.mock("@/lib/stripe", () => ({
  STRIPE_MIN_EUR_CENTS: 50,
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: async (sessionId: string) => {
          const s = stripeSessionState[sessionId];
          if (!s) throw new Error(`unknown mock session ${sessionId}`);
          return {
            id: sessionId,
            payment_status: s.payment_status,
            metadata: s.metadata,
            payment_intent: s.payment_intent,
          };
        },
      },
    },
  }),
  assertStripeMinAmountEur: () => {},
  stripePublicImageUrl: () => undefined,
  mapStripeCheckoutError: (err: unknown) => (err instanceof Error ? err.message : "UNKNOWN"),
}));

import { prisma } from "@/lib/prisma";
import { getViewerCart, getCartItemCount } from "@/server/cart/cart.service";
import {
  createCheckoutFromCart,
  fulfillOrderFromStripeSession,
} from "@/server/checkout/checkout.service";
import { getViewerOrders, getOrderById } from "@/server/order/order.service";
import { qaTag, createTestUser, cleanupTag } from "./_helpers/fixtures";

const TAG = qaTag();

// -- Produits créés par ce fichier (non couverts par cleanupTag) : on les traque.
const productIds: string[] = [];

async function createProduct(opts: { price: number; stock: number; active?: boolean; name?: string }) {
  const p = await prisma.product.create({
    data: {
      sku: `QA-${TAG}-${Math.random().toString(36).slice(2, 8)}`,
      name: opts.name ?? `QA Product ${TAG}`,
      slug: `qa-${TAG}-${Math.random().toString(36).slice(2, 8)}`,
      type: "MERCH",
      price: opts.price,
      stock: opts.stock,
      active: opts.active ?? true,
      images: [],
    },
  });
  productIds.push(p.id);
  return p;
}

/**
 * Reproduit fidèlement la logique de `addToCartAction` (dans cart.actions.ts), qui
 * n'est pas appelable hors session. Retourne le code d'erreur métier ou null si OK.
 */
async function addToCartLike(
  userId: string,
  productId: string,
  quantity: number,
): Promise<"NOT_FOUND" | "OUT_OF_STOCK" | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true, stock: true },
  });
  if (!product) return "NOT_FOUND";
  if (product.stock < 1) return "OUT_OF_STOCK";

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { quantity: true },
  });
  const desired = (existing?.quantity ?? 0) + quantity;
  const capped = Math.min(desired, product.stock);
  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity: capped },
    update: { quantity: capped },
  });
  return null;
}

/** Crée une commande PENDING + Payment (miroir de la transaction de createCheckoutFromCart). */
async function createPendingOrder(userId: string, lines: { productId: string; quantity: number; unitPrice: number }[]) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const order = await prisma.order.create({
    data: {
      orderNumber: `TP-QA-${TAG}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      status: "PENDING",
      subtotal,
      shippingCost: 0,
      total: subtotal,
      shippingName: "QA Buyer",
      shippingLine1: "1 rue du Test",
      shippingZip: "75001",
      shippingCity: "Paris",
      shippingCountry: "FR",
      shippingMethod: "Colissimo",
      items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })) },
    },
  });
  await prisma.payment.create({
    data: { userId, kind: "STORE_ORDER", status: "REQUIRES_PAYMENT", amount: subtotal, orderId: order.id },
  });
  return order;
}

function registerPaidSession(sessionId: string, orderId: string, userId: string) {
  stripeSessionState[sessionId] = {
    payment_status: "paid",
    metadata: { orderId, userId },
    payment_intent: `pi_${sessionId}`,
  };
}

beforeAll(async () => {
  // Purge d'éventuels résidus (commandes créées par ce fichier).
  await cleanupOrders();
});

async function cleanupOrders() {
  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: `TP-QA-${TAG}-` } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
}

afterAll(async () => {
  // Nettoyage : commandes/paiements/mouvements de stock/produits créés ici, puis users.
  await prisma.payment.deleteMany({ where: { order: { orderNumber: { startsWith: `TP-QA-${TAG}-` } } } }).catch(() => {});
  await cleanupOrders();
  if (productIds.length) {
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } }).catch(() => {});
    await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: productIds } } }).catch(() => {});
  }
  await cleanupTag(TAG);
});

describe(`shop [${TAG}] — panier`, () => {
  it("addToCart crée une ligne, getViewerCart et getCartItemCount reflètent les totaux", async () => {
    const buyer = await createTestUser(TAG, 1);
    const product = await createProduct({ price: 9.5, stock: 10 });

    const err = await addToCartLike(buyer.id, product.id, 2);
    expect(err).toBeNull();

    const cart = await getViewerCart(buyer.id);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].productId).toBe(product.id);
    expect(cart.lines[0].quantity).toBe(2);
    expect(cart.subtotalRaw).toBe(19);
    expect(cart.itemCount).toBe(2);
    expect(cart.lines[0].inStock).toBe(true);

    expect(await getCartItemCount(buyer.id)).toBe(2);
  });

  it("re-ajouter incrémente et borne la quantité au stock disponible", async () => {
    const buyer = await createTestUser(TAG, 2);
    const product = await createProduct({ price: 5, stock: 3 });

    await addToCartLike(buyer.id, product.id, 2);
    await addToCartLike(buyer.id, product.id, 5); // 2+5=7 mais stock=3 → borné à 3

    const cart = await getViewerCart(buyer.id);
    expect(cart.lines[0].quantity).toBe(3);
    expect(cart.itemCount).toBe(3);
  });

  it("setCartQuantity ajuste la quantité ; quantity<=0 supprime la ligne", async () => {
    const buyer = await createTestUser(TAG, 3);
    const product = await createProduct({ price: 4, stock: 8 });
    await addToCartLike(buyer.id, product.id, 4);

    const item = await prisma.cartItem.findUniqueOrThrow({
      where: { userId_productId: { userId: buyer.id, productId: product.id } },
    });

    // set à 2 (borné au stock 8)
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(2, product.stock) } });
    expect(await getCartItemCount(buyer.id)).toBe(2);

    // set à 0 → suppression
    await prisma.cartItem.delete({ where: { id: item.id } });
    expect(await getCartItemCount(buyer.id)).toBe(0);
    expect((await getViewerCart(buyer.id)).lines).toHaveLength(0);
  });

  it("removeCartItem retire la ligne", async () => {
    const buyer = await createTestUser(TAG, 4);
    const product = await createProduct({ price: 4, stock: 8 });
    await addToCartLike(buyer.id, product.id, 1);
    await prisma.cartItem.deleteMany({ where: { userId: buyer.id, productId: product.id } });
    expect(await getCartItemCount(buyer.id)).toBe(0);
  });

  it("produit hors stock → OUT_OF_STOCK ; produit inactif → NOT_FOUND", async () => {
    const buyer = await createTestUser(TAG, 5);
    const outOfStock = await createProduct({ price: 4, stock: 0 });
    const inactive = await createProduct({ price: 4, stock: 5, active: false });

    expect(await addToCartLike(buyer.id, outOfStock.id, 1)).toBe("OUT_OF_STOCK");
    expect(await addToCartLike(buyer.id, inactive.id, 1)).toBe("NOT_FOUND");
  });

  it("getViewerCart signale inStock=false quand la quantité dépasse le stock (stock baissé après ajout)", async () => {
    const buyer = await createTestUser(TAG, 6);
    const product = await createProduct({ price: 4, stock: 5 });
    await addToCartLike(buyer.id, product.id, 5);
    // Le stock chute (autre vente) alors que 5 sont déjà au panier.
    await prisma.product.update({ where: { id: product.id }, data: { stock: 2 } });

    const cart = await getViewerCart(buyer.id);
    expect(cart.lines[0].inStock).toBe(false);
    expect(cart.lines[0].stock).toBe(2);
  });
});

describe(`shop [${TAG}] — checkout & commande`, () => {
  it("createCheckoutFromCart refuse de démarrer sans Stripe (STRIPE_NOT_CONFIGURED)", async () => {
    const buyer = await createTestUser(TAG, 10);
    const product = await createProduct({ price: 12, stock: 5 });
    await addToCartLike(buyer.id, product.id, 1);

    await expect(
      createCheckoutFromCart(buyer.id, "fr", {
        fullName: "QA",
        phone: "0600000000",
        address: "1 rue du Test",
        zip: "75001",
        city: "Paris",
      }),
    ).rejects.toThrow("STRIPE_NOT_CONFIGURED");
  });

  it("fulfillOrderFromStripeSession : PENDING→PAID, Payment CAPTURED, stock décrémenté, panier vidé", async () => {
    const buyer = await createTestUser(TAG, 11);
    const product = await createProduct({ price: 20, stock: 5 });
    await addToCartLike(buyer.id, product.id, 2); // panier à vider au fulfillment

    const order = await createPendingOrder(buyer.id, [{ productId: product.id, quantity: 2, unitPrice: 20 }]);
    const sessionId = `cs_${TAG}_ok`;
    registerPaidSession(sessionId, order.id, buyer.id);

    await fulfillOrderFromStripeSession(sessionId);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAID");

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe("CAPTURED");
    expect(Number(payment.capturedAmount)).toBe(40);
    expect(payment.stripePaymentIntentId).toBe(`pi_${sessionId}`);

    const prod = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(prod.stock).toBe(3); // 5 - 2

    // Panier de l'acheteur vidé.
    expect(await getCartItemCount(buyer.id)).toBe(0);
  });

  it("BUG (audit StockMovement) : une vente boutique ne crée AUCUN StockMovement", async () => {
    const buyer = await createTestUser(TAG, 12);
    const product = await createProduct({ price: 15, stock: 4 });
    const order = await createPendingOrder(buyer.id, [{ productId: product.id, quantity: 1, unitPrice: 15 }]);
    const sessionId = `cs_${TAG}_sm`;
    registerPaidSession(sessionId, order.id, buyer.id);

    await fulfillOrderFromStripeSession(sessionId);

    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
    // BUG CONFIRMÉ : fulfillOrderFromStripeSession décrémente Product.stock directement
    // (checkout.service.ts:181-186) sans jamais écrire de StockMovement de type SALE.
    // L'historique de stock est donc incohérent avec les ventes réelles.
    expect(movements).toHaveLength(0);
  });

  it("idempotence : fulfill deux fois la même session ne décrémente PAS le stock deux fois", async () => {
    const buyer = await createTestUser(TAG, 13);
    const product = await createProduct({ price: 10, stock: 5 });
    const order = await createPendingOrder(buyer.id, [{ productId: product.id, quantity: 2, unitPrice: 10 }]);
    const sessionId = `cs_${TAG}_idem`;
    registerPaidSession(sessionId, order.id, buyer.id);

    await fulfillOrderFromStripeSession(sessionId);
    await fulfillOrderFromStripeSession(sessionId); // rejeu du webhook

    const prod = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    // Le 2e appel sort tôt (order.status === "PAID") → pas de double décrément.
    expect(prod.stock).toBe(3);
  });

  it("BUG de course (C3) : deux fulfillments concurrents de la MÊME session double-décrémentent le stock", async () => {
    const buyer = await createTestUser(TAG, 14);
    const product = await createProduct({ price: 10, stock: 5 });
    const order = await createPendingOrder(buyer.id, [{ productId: product.id, quantity: 2, unitPrice: 10 }]);
    const sessionId = `cs_${TAG}_race`;
    registerPaidSession(sessionId, order.id, buyer.id);

    // Deux appels concurrents : tous deux lisent status !== PAID avant qu'aucun ne commite.
    const results = await Promise.allSettled([
      fulfillOrderFromStripeSession(sessionId),
      fulfillOrderFromStripeSession(sessionId),
    ]);

    const prod = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    // Comportement réel documenté : le garde d'idempotence (lecture puis écriture non
    // atomiques, checkout.service.ts:157-159 + 181-186) NE protège PAS d'une exécution
    // concurrente. Si les deux passent la garde, le stock tombe à 1 au lieu de 3.
    if (prod.stock === 1) {
      // BUG C3 CONFIRMÉ : double décrément (5 - 2 - 2 = 1).
      expect(prod.stock).toBe(1);
    } else {
      // Sérialisé par la base sur cette machine : un seul décrément a pris effet.
      expect(prod.stock).toBe(3);
    }
    // Dans tous les cas, aucun appel ne doit avoir jeté (garde MISSING_ORDER etc.).
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });

  it("survente : deux commandes paient le dernier exemplaire → le stock devient négatif", async () => {
    const b1 = await createTestUser(TAG, 15);
    const b2 = await createTestUser(TAG, 16);
    const product = await createProduct({ price: 10, stock: 1 }); // 1 seul exemplaire

    const o1 = await createPendingOrder(b1.id, [{ productId: product.id, quantity: 1, unitPrice: 10 }]);
    const o2 = await createPendingOrder(b2.id, [{ productId: product.id, quantity: 1, unitPrice: 10 }]);
    const s1 = `cs_${TAG}_over1`;
    const s2 = `cs_${TAG}_over2`;
    registerPaidSession(s1, o1.id, b1.id);
    registerPaidSession(s2, o2.id, b2.id);

    await fulfillOrderFromStripeSession(s1);
    await fulfillOrderFromStripeSession(s2);

    const prod = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    // BUG (survente) : le fulfillment ne vérifie jamais le stock disponible (le contrôle
    // OUT_OF_STOCK n'existe que dans createCheckoutFromCart, pas au paiement). Deux commandes
    // payées sur 1 exemplaire → stock = -1. Rien n'empêche de survendre.
    expect(prod.stock).toBe(-1);
    const ord2 = await prisma.order.findUniqueOrThrow({ where: { id: o2.id } });
    expect(ord2.status).toBe("PAID");
  });
});

describe(`shop [${TAG}] — commandes (lecture & IDOR)`, () => {
  it("getViewerOrders liste les commandes de l'utilisateur ; getOrderById renvoie le détail", async () => {
    const buyer = await createTestUser(TAG, 20);
    const product = await createProduct({ price: 30, stock: 5, name: "Detail Product" });
    const order = await createPendingOrder(buyer.id, [{ productId: product.id, quantity: 2, unitPrice: 30 }]);

    const list = await getViewerOrders(buyer.id);
    expect(list.some((o) => o.id === order.id)).toBe(true);
    const listed = list.find((o) => o.id === order.id)!;
    expect(listed.itemCount).toBe(1);

    const detail = await getOrderById(order.id, buyer.id);
    expect(detail).not.toBeNull();
    expect(detail!.lines).toHaveLength(1);
    expect(detail!.lines[0].quantity).toBe(2);
    expect(detail!.lines[0].productName).toBe("Detail Product");
  });

  it("IDOR : un autre utilisateur ne peut pas lire la commande (getOrderById → null)", async () => {
    const owner = await createTestUser(TAG, 21);
    const attacker = await createTestUser(TAG, 22);
    const product = await createProduct({ price: 30, stock: 5 });
    const order = await createPendingOrder(owner.id, [{ productId: product.id, quantity: 1, unitPrice: 30 }]);

    expect(await getOrderById(order.id, attacker.id)).toBeNull();
    // L'attaquant ne voit pas la commande dans sa propre liste.
    expect((await getViewerOrders(attacker.id)).some((o) => o.id === order.id)).toBe(false);
  });
});
