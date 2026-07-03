import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import {
  createShipmentForSale,
  confirmSaleReceipt,
} from "@/server/sale/sale-lifecycle.service";
import { markShipmentShipped } from "@/server/c2c/shipment.service";
import { markShipmentDelivered } from "@/server/c2c/exchange-lifecycle.service";
import { publishListing, expireDueListings } from "@/server/marketplace/marketplace.mutations";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  createTestListing,
  cleanupTag,
} from "../_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

/**
 * Reproductions de BUGS PRODUIT réels. Chaque test est marqué `it.fails` :
 * il décrit le comportement ATTENDU et échoue tant que le bug existe.
 * Si un de ces tests « passe » un jour, le bug est corrigé → retirer le .fails.
 */
describe(`bugs produit [${TAG}] — reproductions documentées`, () => {
  // ——————————————————————————————————————————————————————————————————————
  // BUG 1 — Le statut de la VENTE n'est jamais synchronisé depuis le colis.
  // markShipmentShipped / markShipmentDelivered ne gèrent que shipment.exchangeId
  // (src/server/c2c/shipment.service.ts:116-132, src/server/c2c/exchange-lifecycle.service.ts:22-38).
  // Une vente reste AWAITING_SHIPMENT après expédition ET livraison :
  // → confirmSaleReceipt (exige DELIVERED_WINDOW/DELIVERED) jette NOT_FOUND,
  // → la clôture auto 72 h (processSaleTimeouts, filtre DELIVERED_WINDOW) ne s'applique jamais,
  // → sans intervention admin, le vendeur n'est JAMAIS payé. Sévérité : CRITIQUE.
  // ——————————————————————————————————————————————————————————————————————
  let bug1SaleId = "";
  let bug1BuyerId = "";

  it.fails("BUG: la vente passe à DELIVERED_WINDOW après livraison du colis", async () => {
    const seller = await createTestUser(TAG, 1);
    const buyer = await createTestUser(TAG, 2);
    const { variants } = await createTestCatalog(TAG, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 10,
    });

    const { saleId } = await createSaleFromListing(buyer.id, listingId);
    bug1SaleId = saleId;
    bug1BuyerId = buyer.id;
    const shipmentId = await createShipmentForSale(saleId, seller.id);
    await markShipmentShipped(shipmentId, seller.id, "TRK-BUG-1");
    await markShipmentDelivered(shipmentId, buyer.id);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    // Attendu : DELIVERED_WINDOW (ou au moins SHIPPED après tracking).
    // Observé : AWAITING_SHIPMENT — aucun code ne met à jour Sale.status.
    expect(sale.status).toBe("DELIVERED_WINDOW");
  });

  it.fails("BUG: l'acheteur peut confirmer la réception après livraison (NOT_FOUND aujourd'hui)", async () => {
    // Dépend du setup du test précédent (exécution séquentielle du fichier).
    expect(bug1SaleId).not.toBe("");
    // Attendu : clôture de la vente. Observé : NOT_FOUND car la vente est
    // restée AWAITING_SHIPMENT (statut jamais synchronisé depuis le colis).
    await confirmSaleReceipt(bug1SaleId, bug1BuyerId);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: bug1SaleId } });
    expect(sale.status).toBe("COMPLETED");
  });

  // ——————————————————————————————————————————————————————————————————————
  // BUG 2 — expireDueListings libère les réservations TROP largement.
  // src/server/marketplace/marketplace.mutations.ts:117-121 : le décrément de
  // reservedQuantity cible userId+variantId SANS filtre de condition ni garde
  // reservedQuantity > 0. Pour un vendeur possédant plusieurs états de la même
  // carte : l'expiration d'UNE annonce décrémente TOUTES les lignes →
  // réservations d'annonces encore actives perdues + reservedQuantity négatif.
  // Sévérité : HAUTE (permet la survente ; corrompt les compteurs de stock).
  // ——————————————————————————————————————————————————————————————————————
  let bug2SellerId = "";
  let bug2VariantId = "";
  let bug2ActiveListingId = "";

  it("setup bug 2/3 : trois états possédés, une annonce active (EXCELLENT), une expirée (GOOD)", async () => {
    const seller = await createTestUser(TAG, 3);
    bug2SellerId = seller.id;
    const { variants } = await createTestCatalog(`${TAG}b`, 1);
    bug2VariantId = variants[0].id;

    await addToCollection(seller.id, variants[0].id, { condition: "EXCELLENT", quantity: 1 });
    await addToCollection(seller.id, variants[0].id, { condition: "GOOD", quantity: 1 });
    await addToCollection(seller.id, variants[0].id, { condition: "MINT", quantity: 1 });

    bug2ActiveListingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 30,
      condition: "EXCELLENT",
    });
    const expiredListingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 5,
      condition: "GOOD",
    });
    await prisma.listing.update({
      where: { id: expiredListingId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expireDueListings();

    // L'annonce GOOD est bien expirée et sa réservation libérée (comportement voulu).
    const expired = await prisma.listing.findUniqueOrThrow({ where: { id: expiredListingId } });
    expect(expired.status).toBe("EXPIRED");
    const good = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId: variants[0].id, condition: "GOOD" },
    });
    expect(good.reservedQuantity).toBe(0);
  });

  it.fails("BUG: l'expiration d'une annonce GOOD ne doit pas libérer la réservation de l'annonce EXCELLENT active", async () => {
    const excellent = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: bug2SellerId, variantId: bug2VariantId, condition: "EXCELLENT" },
    });
    // Attendu : 1 (l'annonce EXCELLENT est toujours ACTIVE). Observé : 0.
    expect(excellent.reservedQuantity).toBe(1);
    // Le flag forSale de l'état encore en vente ne doit pas être éteint non plus.
    expect(excellent.forSale).toBe(true);
  });

  it.fails("BUG: reservedQuantity ne doit jamais devenir négatif (état MINT sans annonce : 0 → -1)", async () => {
    const mint = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: bug2SellerId, variantId: bug2VariantId, condition: "MINT" },
    });
    // Attendu : 0 (aucune annonce MINT). Observé : -1 (décrément sans garde).
    expect(mint.reservedQuantity).toBeGreaterThanOrEqual(0);
  });

  // ——————————————————————————————————————————————————————————————————————
  // BUG 3 (enchaîné sur bug 2) — reallocateCollection décrémente sans garde.
  // src/server/sale/sale-lifecycle.service.ts:109-112 : decrement de quantity et
  // reservedQuantity sans vérifier qu'ils sont > 0. Après la libération abusive
  // du bug 2, la clôture d'une vente sur l'annonce EXCELLENT (réservation déjà
  // perdue) pousse reservedQuantity à -1. Sévérité : HAUTE.
  // ——————————————————————————————————————————————————————————————————————
  it.fails("BUG: la clôture d'une vente ne doit pas pousser reservedQuantity sous zéro", async () => {
    const buyer = await createTestUser(TAG, 4);
    const { saleId } = await createSaleFromListing(buyer.id, bug2ActiveListingId);
    await prisma.sale.update({ where: { id: saleId }, data: { status: "DELIVERED_WINDOW" } });
    await confirmSaleReceipt(saleId, buyer.id);

    const excellent = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: bug2SellerId, variantId: bug2VariantId, condition: "EXCELLENT" },
    });
    expect(excellent.quantity).toBe(0);
    // Attendu : 0. Observé : -1 (0 au moment de la vente, décrémenté sans garde).
    expect(excellent.reservedQuantity).toBeGreaterThanOrEqual(0);
  });

  // ——————————————————————————————————————————————————————————————————————
  // BUG 4 — Double vente possible en concurrence.
  // src/server/sale/sale.mutations.ts:31-48 : contrôle « annonce ACTIVE » puis
  // « pas de vente en cours » AVANT la transaction de création, sans verrou ni
  // contrainte d'unicité. Deux achats simultanés passent tous les deux les
  // contrôles → deux Sales PAID pour une seule carte. Sévérité : CRITIQUE.
  // ——————————————————————————————————————————————————————————————————————
  it.fails("BUG: deux achats simultanés sur la même annonce ne doivent produire qu'une seule vente", async () => {
    const seller = await createTestUser(TAG, 5);
    const buyerA = await createTestUser(TAG, 6);
    const buyerB = await createTestUser(TAG, 7);
    const { variants } = await createTestCatalog(`${TAG}c`, 3);

    // Trois tentatives pour fiabiliser la reproduction de la course.
    for (let round = 0; round < 3; round++) {
      await addToCollection(seller.id, variants[round].id);
      const listing = await createTestListing(seller.id, variants[round].id, { price: 10 });

      const results = await Promise.allSettled([
        createSaleFromListing(buyerA.id, listing.id),
        createSaleFromListing(buyerB.id, listing.id),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const sales = await prisma.sale.count({ where: { listingId: listing.id } });

      // Attendu : un seul achat gagne, une seule vente en base.
      // Observé : les deux contrôles lus avant commit laissent passer les deux.
      expect(fulfilled).toBe(1);
      expect(sales).toBe(1);
    }
  });
});
