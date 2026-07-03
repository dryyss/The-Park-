import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import {
  createShipmentForSale,
  confirmSaleReceipt,
  openSaleDispute,
  markSaleFailed,
  processSaleTimeouts,
} from "@/server/sale/sale-lifecycle.service";
import { markShipmentShipped } from "@/server/c2c/shipment.service";
import { markShipmentDelivered } from "@/server/c2c/exchange-lifecycle.service";
import { publishListing } from "@/server/marketplace/marketplace.mutations";
import { debitWalletForSale } from "@/server/wallet/wallet.service";
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

describe(`vente directe [${TAG}] — cycle de vie complet`, () => {
  it("cycle COMPLET : PAID → AWAITING_SHIPMENT → SHIPPED → DELIVERED_WINDOW → COMPLETED (transfert carte, RELEASED, payout wallet)", async () => {
    const seller = await createTestUser(TAG, 1);
    const buyer = await createTestUser(TAG, 2);
    const { variants } = await createTestCatalog(TAG, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 20,
    });

    await creditTestWallet(buyer.id, 50);

    // Achat (chemin simulé sans Stripe → PAID direct) + débit wallet comme en prod.
    const { saleId } = await createSaleFromListing(buyer.id, listingId);
    await debitWalletForSale({ userId: buyer.id, saleId, amountEur: 20 });

    let sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("PAID");

    // Vendeur ouvre l'envoi → AWAITING_SHIPMENT, deadline J+3.
    const shipmentId = await createShipmentForSale(saleId, seller.id);
    sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("AWAITING_SHIPMENT");
    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe("PENDING");
    const deadlineDays = (shipment.notShipDeadline!.getTime() - Date.now()) / 86_400_000;
    expect(deadlineDays).toBeGreaterThan(2.9);
    expect(deadlineDays).toBeLessThan(3.1);

    // Expédition avec tracking.
    await markShipmentShipped(shipmentId, seller.id, "TRK-QA-001");
    const shipped = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.trackingNumber).toBe("TRK-QA-001");

    // Livraison → fenêtre garantie 72 h ouverte sur le colis.
    await markShipmentDelivered(shipmentId, buyer.id);
    const delivered = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.guaranteeEndsAt).not.toBeNull();
    const guaranteeH = (delivered.guaranteeEndsAt!.getTime() - Date.now()) / 3_600_000;
    expect(guaranteeH).toBeGreaterThan(71);
    expect(guaranteeH).toBeLessThan(73);

    // NOTE : la vente devrait passer SHIPPED puis DELIVERED_WINDOW ici, mais aucun
    // service ne synchronise Sale.status depuis le Shipment (voir bugs.test.ts).
    // On aligne manuellement pour tester la suite du cycle.
    await prisma.sale.update({ where: { id: saleId }, data: { status: "DELIVERED_WINDOW" } });

    // L'acheteur confirme la réception → COMPLETED.
    await confirmSaleReceipt(saleId, buyer.id);

    sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("COMPLETED");
    expect(sale.completedAt).not.toBeNull();

    // Transfert de la carte vendeur → acheteur.
    const sellerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId: variants[0].id },
    });
    expect(sellerItem.quantity).toBe(0);
    expect(sellerItem.reservedQuantity).toBe(0);
    const buyerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: buyer.id, variantId: variants[0].id, condition: "EXCELLENT" },
    });
    expect(buyerItem.quantity).toBe(1);

    // Paiement libéré + gains vendeur crédités (vente financée wallet).
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId, kind: "PURCHASE" } });
    expect(payment.status).toBe("RELEASED");
    const sellerWallet = await prisma.walletAccount.findUniqueOrThrow({
      where: { userId: seller.id },
    });
    expect(Number(sellerWallet.earnedBalance)).toBe(20);
    const payoutEntry = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { saleId, type: "SALE_PAYOUT" },
    });
    expect(Number(payoutEntry.amount)).toBe(20);

    // TransactionEvents à chaque étape.
    const events = await prisma.transactionEvent.findMany({
      where: { entityType: "SALE", entityId: saleId },
      orderBy: { createdAt: "asc" },
    });
    const names = events.map((e) => e.event);
    expect(names).toContain("SALE_CREATED");
    expect(names).toContain("PAYMENT_AUTHORIZED");
    expect(names).toContain("SHIPMENT_CREATED");
    expect(names).toContain("SALE_COMPLETED");
  });

  it("SELF_PURCHASE : l'auto-achat est rejeté sans créer de vente", async () => {
    const seller = await createTestUser(TAG, 3);
    const { variants } = await createTestCatalog(`${TAG}b`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });

    await expect(createSaleFromListing(seller.id, listing.id)).rejects.toThrow("SELF_PURCHASE");
    expect(await prisma.sale.count({ where: { listingId: listing.id } })).toBe(0);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe(
      "ACTIVE",
    );
  });

  it("NO_PRICE : annonce SELL sans prix rejetée sans créer de vente", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}c`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listingId = await publishListing(seller.id, { variantId: variants[0].id, type: "SELL" });

    await expect(createSaleFromListing(buyer.id, listingId)).rejects.toThrow("NO_PRICE");
    expect(await prisma.sale.count({ where: { listingId } })).toBe(0);
  });

  it("LISTING_UNAVAILABLE : annonce en pause rejetée", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}d`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "PAUSED" } });

    await expect(createSaleFromListing(buyer.id, listing.id)).rejects.toThrow(
      "LISTING_UNAVAILABLE",
    );
    expect(await prisma.sale.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it("ALREADY_SOLD : 2ᵉ achat rejeté quand une vente est déjà en cours sur l'annonce", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer1 = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const buyer2 = await createTestUser(TAG, 4);
    const { variants } = await createTestCatalog(`${TAG}e`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });

    const { saleId } = await createSaleFromListing(buyer1.id, listing.id);
    // La vente est vivante (PAID) ; on simule une annonce restée/remise ACTIVE.
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "ACTIVE" } });

    await expect(createSaleFromListing(buyer2.id, listing.id)).rejects.toThrow("ALREADY_SOLD");
    const sales = await prisma.sale.findMany({ where: { listingId: listing.id } });
    expect(sales).toHaveLength(1);
    expect(sales[0].id).toBe(saleId);
  });

  it("idempotence : re-achat par le même acheteur d'une vente PENDING_PAYMENT renvoie la même vente", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u4@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}f`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });

    const { saleId } = await createSaleFromListing(buyer.id, listing.id);
    // Ramène la vente à l'état PENDING_PAYMENT (comme avec Stripe configuré).
    await prisma.sale.update({ where: { id: saleId }, data: { status: "PENDING_PAYMENT" } });
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "ACTIVE" } });

    const again = await createSaleFromListing(buyer.id, listing.id);
    expect(again.saleId).toBe(saleId);
    expect(await prisma.sale.count({ where: { listingId: listing.id } })).toBe(1);
  });

  it("createShipmentForSale par un non-vendeur : rejeté sans créer d'envoi", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const intruder = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u4@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}g`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });
    const { saleId } = await createSaleFromListing(buyer.id, listing.id);

    await expect(createShipmentForSale(saleId, intruder.id)).rejects.toThrow("SALE_NOT_FOUND");
    // Idem pour l'acheteur : seul le vendeur peut ouvrir l'envoi.
    await expect(createShipmentForSale(saleId, buyer.id)).rejects.toThrow("SALE_NOT_FOUND");

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("PAID"); // inchangé
    expect(await prisma.shipment.count({ where: { saleId } })).toBe(0);

    // markShipmentShipped par un non-expéditeur : rejeté, colis inchangé.
    const shipmentId = await createShipmentForSale(saleId, seller.id);
    await expect(markShipmentShipped(shipmentId, intruder.id, "TRK-HACK")).rejects.toThrow();
    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe("PENDING");
    expect(shipment.trackingNumber).toBeNull();
  });

  it("confirmSaleReceipt par un non-acheteur : NOT_FOUND et base inchangée", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const intruder = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u4@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}h`, 1);
    const sellerItem = await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });
    const { saleId } = await createSaleFromListing(buyer.id, listing.id);
    await prisma.sale.update({ where: { id: saleId }, data: { status: "DELIVERED_WINDOW" } });

    await expect(confirmSaleReceipt(saleId, intruder.id)).rejects.toThrow("NOT_FOUND");
    await expect(confirmSaleReceipt(saleId, seller.id)).rejects.toThrow("NOT_FOUND");

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("DELIVERED_WINDOW");
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId, kind: "PURCHASE" } });
    expect(payment.status).toBe("AUTHORIZED"); // pas de release
    const itemAfter = await prisma.collectionItem.findUniqueOrThrow({
      where: { id: sellerItem.id },
    });
    expect(itemAfter.quantity).toBe(1); // pas de transfert
  });

  it("litige : openSaleDispute gèle la vente (DISPUTED), bloque la clôture et la garantie auto", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const outsider = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u4@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}i`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });
    const { saleId } = await createSaleFromListing(buyer.id, listing.id);
    const shipmentId = await createShipmentForSale(saleId, seller.id);
    await markShipmentShipped(shipmentId, seller.id, "TRK-QA-002");
    await markShipmentDelivered(shipmentId, buyer.id);
    await prisma.sale.update({ where: { id: saleId }, data: { status: "DELIVERED_WINDOW" } });
    // Garantie déjà échue : le litige doit quand même empêcher la clôture auto.
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { guaranteeEndsAt: new Date(Date.now() - 60_000) },
    });

    // Un tiers ne peut pas ouvrir de litige.
    await expect(openSaleDispute(saleId, outsider.id, "je passe par là")).rejects.toThrow(
      "NOT_FOUND",
    );

    await openSaleDispute(saleId, buyer.id, "carte non conforme à l'annonce");

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("DISPUTED");
    const dispute = await prisma.dispute.findFirstOrThrow({ where: { saleId } });
    expect(dispute.claimantId).toBe(buyer.id);
    expect(dispute.respondentId).toBe(seller.id);
    const events = await prisma.transactionEvent.findMany({
      where: { entityType: "SALE", entityId: saleId },
    });
    expect(events.map((e) => e.event)).toContain("DISPUTE_OPENED");

    // Gel : plus de confirmation possible, et la clôture auto (cron) l'ignore.
    await expect(confirmSaleReceipt(saleId, buyer.id)).rejects.toThrow("NOT_FOUND");
    await processSaleTimeouts();
    const after = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(after.status).toBe("DISPUTED");
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId, kind: "PURCHASE" } });
    expect(payment.status).toBe("AUTHORIZED"); // fonds gelés, non libérés
  });

  it("markSaleFailed : vente annulée, annonce réouverte, paiement annulé", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    const buyer = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u2@qa.test` } });
    const { variants } = await createTestCatalog(`${TAG}j`, 1);
    await addToCollection(seller.id, variants[0].id);
    const listing = await createTestListing(seller.id, variants[0].id, { price: 10 });
    const { saleId } = await createSaleFromListing(buyer.id, listing.id);
    // Ramène la vente à PENDING_PAYMENT (état pré-paiement, comme avec Stripe).
    await prisma.sale.update({ where: { id: saleId }, data: { status: "PENDING_PAYMENT" } });

    await markSaleFailed(saleId);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("CANCELLED");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe(
      "ACTIVE",
    );
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId, kind: "PURCHASE" } });
    expect(payment.status).toBe("CANCELLED");
    const events = await prisma.transactionEvent.findMany({
      where: { entityType: "SALE", entityId: saleId },
    });
    expect(events.map((e) => e.event)).toContain("PAYMENT_FAILED");

    // Idempotent : un 2ᵉ appel ne change rien.
    await markSaleFailed(saleId);
    expect(
      (await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status,
    ).toBe("CANCELLED");
  });
});
