import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addListingToMarketplaceCart,
  removeMarketplaceCartItem,
  purgeExpiredCartItems,
  getViewerMarketplaceCart,
} from "@/server/marketplace-cart/marketplace-cart.service";
import { startAndFulfillMarketplaceCheckoutWithWallet } from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { cancelListing, publishListing } from "@/server/marketplace/marketplace.mutations";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  createTestListing,
  creditTestWallet,
  cleanupTag,
} from "../_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

describe(`panier marketplace [${TAG}] — réservation exclusive, TTL, cooldown, checkout wallet`, () => {
  it("ajoute une annonce au panier (réservation ~30 min) et le 2ᵉ acheteur est rejeté (IN_OTHER_CART)", async () => {
    const seller = await createTestUser(TAG, 1);
    const buyer1 = await createTestUser(TAG, 2);
    const buyer2 = await createTestUser(TAG, 3);
    const { variants } = await createTestCatalog(TAG, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });

    await addListingToMarketplaceCart(buyer1.id, listing.id);

    const item = await prisma.marketplaceCartItem.findUniqueOrThrow({
      where: { listingId: listing.id },
    });
    expect(item.userId).toBe(buyer1.id);
    const ttlMin = (item.expiresAt.getTime() - Date.now()) / 60_000;
    expect(ttlMin).toBeGreaterThan(28);
    expect(ttlMin).toBeLessThan(31);

    // Réservation exclusive : le 2ᵉ acheteur est rejeté.
    await expect(addListingToMarketplaceCart(buyer2.id, listing.id)).rejects.toThrow(
      "IN_OTHER_CART",
    );
    const stillHolder = await prisma.marketplaceCartItem.findUniqueOrThrow({
      where: { listingId: listing.id },
    });
    expect(stillHolder.userId).toBe(buyer1.id);
  });

  it("re-ajouter sa propre réservation renouvelle le TTL", async () => {
    const buyer1 = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const item = await prisma.marketplaceCartItem.findFirstOrThrow({
      where: { userId: buyer1.id },
    });
    // Vieillit artificiellement la réservation (encore valide).
    const aged = new Date(Date.now() + 5 * 60_000);
    await prisma.marketplaceCartItem.update({ where: { id: item.id }, data: { expiresAt: aged } });

    await addListingToMarketplaceCart(buyer1.id, item.listingId);

    const renewed = await prisma.marketplaceCartItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(aged.getTime());
  });

  it("rejette SELF_PURCHASE, NO_PRICE et LISTING_UNAVAILABLE", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}b`, 2);
    await addToCollection(seller.id, variants[0].id);
    await addToCollection(seller.id, variants[1].id);

    const own = await createTestListing(seller.id, variants[0].id, { price: 5 });
    await expect(addListingToMarketplaceCart(seller.id, own.id)).rejects.toThrow("SELF_PURCHASE");

    // Annonce SELL sans prix (publiée sans price via le service produit).
    const noPriceId = await publishListing(seller.id, {
      variantId: variants[1].id,
      type: "SELL",
    });
    await expect(addListingToMarketplaceCart(buyer.id, noPriceId)).rejects.toThrow("NO_PRICE");

    // Annonce indisponible (retirée).
    await cancelListing(seller.id, noPriceId);
    await expect(addListingToMarketplaceCart(buyer.id, noPriceId)).rejects.toThrow(
      "LISTING_UNAVAILABLE",
    );

    const count = await prisma.marketplaceCartItem.count({ where: { userId: buyer.id } });
    expect(count).toBe(0);
  });

  it("réservation expirée : le 2ᵉ acheteur récupère l'annonce et l'ex-détenteur subit un cooldown", async () => {
    const buyer1 = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const buyer2 = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const item = await prisma.marketplaceCartItem.findFirstOrThrow({
      where: { userId: buyer1.id },
    });

    // Expire la réservation de buyer1.
    await prisma.marketplaceCartItem.update({
      where: { id: item.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await addListingToMarketplaceCart(buyer2.id, item.listingId);

    const holder = await prisma.marketplaceCartItem.findUniqueOrThrow({
      where: { listingId: item.listingId },
    });
    expect(holder.userId).toBe(buyer2.id);

    // buyer1 est en cooldown 10 min sur cette annonce.
    const cooldown = await prisma.marketplaceCartCooldown.findUniqueOrThrow({
      where: { userId_listingId: { userId: buyer1.id, listingId: item.listingId } },
    });
    expect(cooldown.cooldownUntil.getTime()).toBeGreaterThan(Date.now());

    // buyer2 libère l'annonce : buyer1 reste bloqué par le cooldown.
    await removeMarketplaceCartItem(buyer2.id, holder.id);
    await expect(addListingToMarketplaceCart(buyer1.id, item.listingId)).rejects.toThrow(
      "CART_COOLDOWN",
    );
  });

  it("purgeExpiredCartItems supprime les réservations échues et pose un cooldown", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    const buyer = await createTestUser(TAG, 4);
    const { variants } = await createTestCatalog(`${TAG}c`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 8 });

    await addListingToMarketplaceCart(buyer.id, listing.id);
    await prisma.marketplaceCartItem.update({
      where: { listingId: listing.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await purgeExpiredCartItems();

    const gone = await prisma.marketplaceCartItem.findUnique({ where: { listingId: listing.id } });
    expect(gone).toBeNull();
    const cooldown = await prisma.marketplaceCartCooldown.findUnique({
      where: { userId_listingId: { userId: buyer.id, listingId: listing.id } },
    });
    expect(cooldown).not.toBeNull();
    expect(cooldown!.cooldownUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it("checkout wallet complet : Sales PAID, wallet débité, ledger cohérent, annonces SOLD, panier vidé, factures émises", async () => {
    const sellerA = await createTestUser(TAG, 5);
    const sellerB = await createTestUser(TAG, 6);
    const buyer = await createTestUser(TAG, 7);
    const { variants } = await createTestCatalog(`${TAG}d`, 2);
    await addToCollection(sellerA.id, variants[0].id);
    await addToCollection(sellerB.id, variants[1].id);
    const listingA = await createTestListing(sellerA.id, variants[0].id, { price: 12 });
    const listingB = await createTestListing(sellerB.id, variants[1].id, { price: 18.5 });

    await creditTestWallet(buyer.id, 100);
    await addListingToMarketplaceCart(buyer.id, listingA.id);
    await addListingToMarketplaceCart(buyer.id, listingB.id);

    const { checkoutId } = await startAndFulfillMarketplaceCheckoutWithWallet({
      buyerId: buyer.id,
      shipping: { shippingMode: "HAND_DELIVERY" },
    });

    const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({
      where: { id: checkoutId },
      include: { lines: true, invoices: true },
    });
    expect(checkout.status).toBe("PAID");
    expect(Number(checkout.total)).toBe(30.5);
    expect(checkout.lines).toHaveLength(2);

    // Sales PAID + Payments capturés.
    for (const line of checkout.lines) {
      const sale = await prisma.sale.findUniqueOrThrow({ where: { id: line.saleId } });
      expect(sale.status).toBe("PAID");
      const payment = await prisma.payment.findFirstOrThrow({
        where: { saleId: line.saleId, kind: "PURCHASE" },
      });
      expect(payment.status).toBe("CAPTURED");
    }

    // Annonces SOLD.
    for (const id of [listingA.id, listingB.id]) {
      expect((await prisma.listing.findUniqueOrThrow({ where: { id } })).status).toBe("SOLD");
    }

    // Wallet débité du sous-total, une entrée PURCHASE par vente, balanceAfter cohérent.
    const account = await prisma.walletAccount.findUniqueOrThrow({ where: { userId: buyer.id } });
    expect(Number(account.depositBalance)).toBe(69.5);
    const purchases = await prisma.walletLedgerEntry.findMany({
      where: { walletAccountId: account.id, type: "PURCHASE" },
      orderBy: { createdAt: "asc" },
    });
    expect(purchases).toHaveLength(2);
    const sum = purchases.reduce((s, e) => s + Number(e.amount), 0);
    expect(Math.round(sum * 100) / 100).toBe(-30.5);
    expect(Number(purchases[purchases.length - 1].balanceAfter)).toBe(69.5);

    // Panier vidé.
    const cart = await getViewerMarketplaceCart(buyer.id);
    expect(cart.itemCount).toBe(0);

    // Factures : 1 acheteur + 1 par vendeur.
    expect(checkout.invoices.filter((i) => i.recipient === "BUYER")).toHaveLength(1);
    expect(checkout.invoices.filter((i) => i.recipient === "SELLER")).toHaveLength(2);
  });

  it("checkout wallet : solde insuffisant rejeté sans effet de bord", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u5@qa.test` } });
    const buyer = await createTestUser(TAG, 8);
    const { variants } = await createTestCatalog(`${TAG}e`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 20 });

    await creditTestWallet(buyer.id, 5);
    await addListingToMarketplaceCart(buyer.id, listing.id);

    await expect(
      startAndFulfillMarketplaceCheckoutWithWallet({ buyerId: buyer.id, shipping: { shippingMode: "HAND_DELIVERY" } }),
    ).rejects.toThrow("INSUFFICIENT_WALLET");

    // Aucune vente créée, annonce toujours ACTIVE, wallet intact, pas de checkout.
    expect(await prisma.sale.count({ where: { listingId: listing.id } })).toBe(0);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe(
      "ACTIVE",
    );
    const account = await prisma.walletAccount.findUniqueOrThrow({ where: { userId: buyer.id } });
    expect(Number(account.depositBalance)).toBe(5);
    expect(await prisma.marketplaceCheckout.count({ where: { buyerId: buyer.id } })).toBe(0);
  });

  // BUG: en mode wallet sans Stripe, createSaleFromListing passe la vente directement à PAID ;
  // cancelPendingCheckout → markSaleFailed exige PENDING_PAYMENT et ne fait alors RIEN
  // (src/server/sale/sale-lifecycle.service.ts:52 +
  // src/server/marketplace-cart/marketplace-cart-checkout.service.ts:76-91).
  // Observé (probe) : sale=PAID, listing=SOLD, wallet débité (90 € au lieu de 100),
  // payment=AUTHORIZED, checkout=CANCELLED → l'acheteur a payé une ligne d'un checkout annulé.
  it.fails("échec en cours de checkout : rollback complet (ventes annulées, annonces réactivées, wallet remboursé)", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u5@qa.test` } });
    const buyer = await createTestUser(TAG, 9);
    const { variants } = await createTestCatalog(`${TAG}f`, 2);
    await addToCollection(seller.id, variants[0].id);
    await addToCollection(seller.id, variants[1].id);
    const listing1 = await createTestListing(seller.id, variants[0].id, { price: 10 });
    // listing2 ajouté au panier PUIS retiré par le vendeur → indisponible au checkout.
    const listing2 = await createTestListing(seller.id, variants[1].id, { price: 15 });

    await creditTestWallet(buyer.id, 100);
    await addListingToMarketplaceCart(buyer.id, listing1.id);
    await addListingToMarketplaceCart(buyer.id, listing2.id);

    await prisma.listing.update({ where: { id: listing2.id }, data: { status: "CANCELLED" } });

    await expect(
      startAndFulfillMarketplaceCheckoutWithWallet({ buyerId: buyer.id, shipping: { shippingMode: "HAND_DELIVERY" } }),
    ).rejects.toThrow("LISTING_UNAVAILABLE");

    // La vente créée pour listing1 est annulée, l'annonce réactivée.
    const sale1 = await prisma.sale.findFirstOrThrow({ where: { listingId: listing1.id } });
    expect(sale1.status).toBe("CANCELLED");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing1.id } })).status).toBe(
      "ACTIVE",
    );

    // Wallet remboursé intégralement (débit + refund → net 0).
    const account = await prisma.walletAccount.findUniqueOrThrow({ where: { userId: buyer.id } });
    expect(Number(account.depositBalance)).toBe(100);

    // Checkout marqué CANCELLED.
    const checkout = await prisma.marketplaceCheckout.findFirstOrThrow({
      where: { buyerId: buyer.id },
    });
    expect(checkout.status).toBe("CANCELLED");
  });
});
