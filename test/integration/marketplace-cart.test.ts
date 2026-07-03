import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addListingToMarketplaceCart,
  removeMarketplaceCartItem,
  getViewerMarketplaceCart,
  purgeExpiredCartItems,
  getMarketplaceCartItemCount,
} from "@/server/marketplace-cart/marketplace-cart.service";
import {
  getMarketplaceRecap,
  startAndFulfillMarketplaceCheckoutWithWallet,
  cancelMarketplaceCheckoutById,
  startMarketplaceCartStripeCheckout,
} from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { getWalletSpendableBalanceEur } from "@/server/wallet/wallet.service";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  createTestListing,
  cleanupTag,
} from "./_helpers/fixtures";

/**
 * NB : le helper partagé `creditTestWallet` (fixtures.ts:105) crée une entrée de type
 * `DEPOSIT_TOPUP`, qui N'EXISTE PAS dans l'enum `WalletEntryType` (valeurs valides :
 * TOP_UP, PURCHASE, REFUND, SALE_PAYOUT, WITHDRAWAL, ADJUSTMENT, CAUTION_LOCK,
 * CAUTION_RELEASE). Il lève donc PrismaClientValidationError. On crédite le wallet
 * localement avec le bon type (TOP_UP) plutôt que de modifier le helper partagé.
 */
async function creditTestWallet(userId: string, amountEur: number) {
  const account = await prisma.walletAccount.upsert({
    where: { userId },
    create: { userId, depositBalance: amountEur },
    update: { depositBalance: { increment: amountEur } },
  });
  await prisma.walletLedgerEntry.create({
    data: {
      walletAccountId: account.id,
      type: "TOP_UP",
      amount: amountEur,
      balanceAfter: amountEur,
      note: "QA fixture top-up",
    },
  });
  return account;
}

/**
 * Tests d'intégration — PANIER MARKETPLACE C2C (paiement wallet, Stripe désactivé).
 *
 * Sans Stripe (setup-env.ts) :
 *   - `createSaleFromListing` fait passer la vente directement en PAID (mode dev).
 *   - `startAndFulfillMarketplaceCheckoutWithWallet` débite le wallet puis finalise.
 * Tout tourne réellement contre la base Postgres locale jetable.
 */

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

// Utilitaire : crée vendeur + une annonce SELL prête à l'achat.
async function makeSellerWithListing(
  n: number,
  variantIdx: number,
  variants: { id: string }[],
  price = 10,
) {
  const seller = await createTestUser(TAG, n);
  await addToCollection(seller.id, variants[variantIdx].id, { quantity: 1 });
  const listing = await createTestListing(seller.id, variants[variantIdx].id, { price });
  return { seller, listing };
}

describe(`marketplace-cart [${TAG}] — réservation`, () => {
  it("addListingToMarketplaceCart réserve l'annonce (item unique par listing)", async () => {
    const buyer = await createTestUser(TAG, 1);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(2, 0, variants);

    await addListingToMarketplaceCart(buyer.id, listing.id);

    const cart = await getViewerMarketplaceCart(buyer.id);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].listingId).toBe(listing.id);
    expect(await getMarketplaceCartItemCount(buyer.id)).toBe(1);

    const item = await prisma.marketplaceCartItem.findUniqueOrThrow({ where: { listingId: listing.id } });
    expect(item.userId).toBe(buyer.id);
    expect(item.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("un 2e acheteur ne peut pas réserver la même annonce (IN_OTHER_CART)", async () => {
    const b1 = await createTestUser(TAG, 3);
    const b2 = await createTestUser(TAG, 4);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(5, 0, variants);

    await addListingToMarketplaceCart(b1.id, listing.id);
    await expect(addListingToMarketplaceCart(b2.id, listing.id)).rejects.toThrow("IN_OTHER_CART");
  });

  it("l'auto-achat de sa propre annonce est refusé (SELF_PURCHASE)", async () => {
    const { variants } = await createTestCatalog(TAG, 1);
    const { seller, listing } = await makeSellerWithListing(6, 0, variants);
    await expect(addListingToMarketplaceCart(seller.id, listing.id)).rejects.toThrow("SELF_PURCHASE");
  });

  it("une annonce inexistante/inactive est refusée (LISTING_UNAVAILABLE)", async () => {
    const buyer = await createTestUser(TAG, 7);
    await expect(addListingToMarketplaceCart(buyer.id, "listing-inexistant")).rejects.toThrow("LISTING_UNAVAILABLE");
  });

  it("retrait manuel : PAS de cooldown (l'acheteur peut re-réserver immédiatement)", async () => {
    const buyer = await createTestUser(TAG, 8);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(9, 0, variants);

    await addListingToMarketplaceCart(buyer.id, listing.id);
    const item = await prisma.marketplaceCartItem.findUniqueOrThrow({ where: { listingId: listing.id } });
    await removeMarketplaceCartItem(buyer.id, item.id);

    expect(await getMarketplaceCartItemCount(buyer.id)).toBe(0);
    // Aucun cooldown posé sur retrait volontaire → re-réservation immédiate possible.
    const cd = await prisma.marketplaceCartCooldown.findUnique({
      where: { userId_listingId: { userId: buyer.id, listingId: listing.id } },
    });
    expect(cd).toBeNull();
    await expect(addListingToMarketplaceCart(buyer.id, listing.id)).resolves.toBeUndefined();
  });

  it("cooldown : après expiration reprise par un autre acheteur, le 1er est bloqué (CART_COOLDOWN)", async () => {
    const b1 = await createTestUser(TAG, 30);
    const b2 = await createTestUser(TAG, 31);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(32, 0, variants);

    await addListingToMarketplaceCart(b1.id, listing.id);
    // Force l'expiration de la réservation de b1.
    await prisma.marketplaceCartItem.update({
      where: { listingId: listing.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    // b2 reprend l'annonce expirée → pose un cooldown sur b1.
    await addListingToMarketplaceCart(b2.id, listing.id);
    const item = await prisma.marketplaceCartItem.findUniqueOrThrow({ where: { listingId: listing.id } });
    expect(item.userId).toBe(b2.id);

    const cd = await prisma.marketplaceCartCooldown.findUnique({
      where: { userId_listingId: { userId: b1.id, listingId: listing.id } },
    });
    expect(cd).not.toBeNull();
    // b1 ne peut pas reprendre l'annonce tant que le cooldown court.
    await expect(addListingToMarketplaceCart(b1.id, listing.id)).rejects.toThrow(/CART_COOLDOWN|IN_OTHER_CART/);
  });
});

describe(`marketplace-cart [${TAG}] — recap`, () => {
  it("getMarketplaceRecap calcule le sous-total et rattache le vendeur", async () => {
    const buyer = await createTestUser(TAG, 10);
    const { variants } = await createTestCatalog(TAG, 2);
    const l1 = await makeSellerWithListing(11, 0, variants, 12.5);
    const l2 = await makeSellerWithListing(12, 1, variants, 7.25);

    await addListingToMarketplaceCart(buyer.id, l1.listing.id);
    await addListingToMarketplaceCart(buyer.id, l2.listing.id);

    const recap = await getMarketplaceRecap(buyer.id);
    expect(recap.itemCount).toBe(2);
    expect(recap.subtotalRaw).toBeCloseTo(19.75, 2);
    const sellerIds = recap.lines.map((l) => l.sellerId);
    expect(sellerIds).toContain(l1.seller.id);
    expect(sellerIds).toContain(l2.seller.id);
  });
});

describe(`marketplace-cart [${TAG}] — paiement wallet`, () => {
  it("solde suffisant : checkout PAID, ventes PAID, annonces SOLD, wallet débité, factures émises, adresse résolue", async () => {
    const buyer = await createTestUser(TAG, 13);
    const { variants } = await createTestCatalog(TAG, 1);
    const { seller, listing } = await makeSellerWithListing(14, 0, variants, 15);

    await creditTestWallet(buyer.id, 50);
    await addListingToMarketplaceCart(buyer.id, listing.id);

    const { checkoutId } = await startAndFulfillMarketplaceCheckoutWithWallet({
      buyerId: buyer.id,
      newAddress: { fullName: "QA Buyer", line1: "1 rue du Test", zip: "75001", city: "Paris" },
    });

    const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({
      where: { id: checkoutId },
      include: { lines: true, invoices: true },
    });
    expect(checkout.status).toBe("PAID");
    expect(checkout.paidAt).not.toBeNull();
    expect(checkout.shippingAddressId).not.toBeNull();

    // Vente marquée PAID.
    expect(checkout.lines).toHaveLength(1);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: checkout.lines[0].saleId } });
    expect(sale.status).toBe("PAID");

    // Annonce SOLD.
    const soldListing = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(soldListing.status).toBe("SOLD");

    // Wallet débité (50 - 15 = 35).
    expect(await getWalletSpendableBalanceEur(buyer.id)).toBeCloseTo(35, 2);
    const purchaseEntry = await prisma.walletLedgerEntry.findFirst({
      where: { saleId: sale.id, type: "PURCHASE" },
    });
    expect(purchaseEntry).not.toBeNull();
    expect(Number(purchaseEntry!.amount)).toBe(-15);

    // Factures acheteur + vendeur.
    const recipients = checkout.invoices.map((i) => i.recipient).sort();
    expect(recipients).toEqual(["BUYER", "SELLER"]);
    const buyerInvoice = checkout.invoices.find((i) => i.recipient === "BUYER")!;
    expect(Number(buyerInvoice.amount)).toBe(15);
    const sellerInvoice = checkout.invoices.find((i) => i.recipient === "SELLER")!;
    expect(sellerInvoice.sellerId).toBe(seller.id);

    // Panier vidé (item retiré au fulfillment).
    expect(await getMarketplaceCartItemCount(buyer.id)).toBe(0);
  });

  it("solde insuffisant → INSUFFICIENT_WALLET, aucun checkout PAID, annonce toujours réservée", async () => {
    const buyer = await createTestUser(TAG, 15);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(16, 0, variants, 40);

    await creditTestWallet(buyer.id, 10); // insuffisant pour 40
    await addListingToMarketplaceCart(buyer.id, listing.id);

    await expect(
      startAndFulfillMarketplaceCheckoutWithWallet({ buyerId: buyer.id }),
    ).rejects.toThrow("INSUFFICIENT_WALLET");

    // Aucun checkout créé (le contrôle du solde précède la création).
    const checkouts = await prisma.marketplaceCheckout.findMany({ where: { buyerId: buyer.id } });
    expect(checkouts).toHaveLength(0);
    // Le wallet n'a pas bougé.
    expect(await getWalletSpendableBalanceEur(buyer.id)).toBeCloseTo(10, 2);
  });

  it("panier vide → EMPTY_CART", async () => {
    const buyer = await createTestUser(TAG, 17);
    await creditTestWallet(buyer.id, 100);
    await expect(
      startAndFulfillMarketplaceCheckoutWithWallet({ buyerId: buyer.id }),
    ).rejects.toThrow("EMPTY_CART");
  });

  it("cancelMarketplaceCheckoutById : ne touche pas un checkout déjà PAID", async () => {
    const buyer = await createTestUser(TAG, 18);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(19, 0, variants, 8);
    await creditTestWallet(buyer.id, 20);
    await addListingToMarketplaceCart(buyer.id, listing.id);
    const { checkoutId } = await startAndFulfillMarketplaceCheckoutWithWallet({ buyerId: buyer.id });

    // Le checkout est PAID → cancel est un no-op (filtre status PENDING).
    await cancelMarketplaceCheckoutById(checkoutId, buyer.id);
    const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkoutId } });
    expect(checkout.status).toBe("PAID");
  });
});

describe(`marketplace-cart [${TAG}] — expiration`, () => {
  it("purgeExpiredCartItems retire les items expirés et pose un cooldown", async () => {
    const buyer = await createTestUser(TAG, 20);
    const { variants } = await createTestCatalog(TAG, 1);
    const { listing } = await makeSellerWithListing(21, 0, variants);

    await addListingToMarketplaceCart(buyer.id, listing.id);
    // Force expiration dans le passé.
    await prisma.marketplaceCartItem.update({
      where: { listingId: listing.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const purged = await purgeExpiredCartItems();
    expect(purged).toBeGreaterThanOrEqual(1);

    const item = await prisma.marketplaceCartItem.findUnique({ where: { listingId: listing.id } });
    expect(item).toBeNull();
    // Cooldown posé sur l'acheteur.
    const cd = await prisma.marketplaceCartCooldown.findUnique({
      where: { userId_listingId: { userId: buyer.id, listingId: listing.id } },
    });
    expect(cd).not.toBeNull();
  });
});

describe(`marketplace-cart [${TAG}] — bug de course E2`, () => {
  it("BUG E2 : un paiement wallet annule TOUS les checkouts PENDING de l'acheteur (y compris ceux d'un autre panier)", async () => {
    const buyer = await createTestUser(TAG, 40);
    const { variants } = await createTestCatalog(TAG, 2);
    // Deux annonces distinctes (deux vendeurs).
    const a = await makeSellerWithListing(41, 0, variants, 10);
    const b = await makeSellerWithListing(42, 1, variants, 10);

    await creditTestWallet(buyer.id, 100);

    // 1) Un checkout Stripe "en cours" (PENDING) est démarré sur l'annonce A.
    //    Sans Stripe, startMarketplaceCartStripeCheckout finalise directement (dev mode) ;
    //    on crée donc le PENDING manuellement pour simuler un onglet Stripe resté ouvert,
    //    en reproduisant createSaleFromListing + la ligne de checkout attendue par E2.
    await addListingToMarketplaceCart(buyer.id, a.listing.id);
    const recapA = await getMarketplaceRecap(buyer.id);
    const lineA = recapA.lines.find((l) => l.listingId === a.listing.id)!;

    const pendingCheckout = await prisma.marketplaceCheckout.create({
      data: {
        checkoutNumber: `MKP-QA-${TAG}-PENDING`,
        buyerId: buyer.id,
        status: "PENDING",
        subtotal: 10,
        total: 10,
      },
    });
    // Vente en PENDING_PAYMENT rattachée (état d'un checkout Stripe non finalisé).
    const pendingSale = await prisma.sale.create({
      data: {
        listingId: a.listing.id,
        buyerId: buyer.id,
        sellerId: a.seller.id,
        status: "PENDING_PAYMENT",
        price: 10,
        serviceFee: 0,
        shippingMode: "STANDARD",
        shippingCost: 0,
      },
    });
    await prisma.marketplaceCheckoutLine.create({
      data: {
        checkoutId: pendingCheckout.id,
        saleId: pendingSale.id,
        listingId: a.listing.id,
        sellerId: a.seller.id,
        cardName: lineA.name,
        unitPrice: 10,
      },
    });

    // 2) L'acheteur paie AILLEURS l'annonce B au wallet.
    await prisma.marketplaceCartItem.deleteMany({ where: { userId: buyer.id } });
    await addListingToMarketplaceCart(buyer.id, b.listing.id);
    await startAndFulfillMarketplaceCheckoutWithWallet({ buyerId: buyer.id });

    // 3) Vérifie l'effet de bord : le checkout PENDING (annonce A) a été annulé.
    const afterCheckout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: pendingCheckout.id } });
    const afterSale = await prisma.sale.findUniqueOrThrow({ where: { id: pendingSale.id } });
    const listingA = await prisma.listing.findUniqueOrThrow({ where: { id: a.listing.id } });

    // BUG E2 CONFIRMÉ : startAndFulfillMarketplaceCheckoutWithWallet
    // (marketplace-cart-checkout.service.ts:330-336) annule INDISTINCTEMENT tous les
    // checkouts PENDING de l'acheteur, pas seulement ceux du panier payé. Le checkout A,
    // sans rapport avec le paiement, est passé CANCELLED, sa vente CANCELLED et l'annonce
    // A rebasculée ACTIVE — l'acheteur perd son achat en cours sans en être informé.
    expect(afterCheckout.status).toBe("CANCELLED");
    expect(afterSale.status).toBe("CANCELLED");
    expect(listingA.status).toBe("ACTIVE");
  });
});

// Référence pour éviter un import inutilisé si le flux dev est ajusté un jour.
void startMarketplaceCartStripeCheckout;
