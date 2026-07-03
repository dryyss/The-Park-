import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import {
  createShipmentForSale,
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
  creditTestWallet,
  cleanupTag,
} from "../_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

describe(`timeouts [${TAG}] — processSaleTimeouts`, () => {
  it("J+3 non expédié : NOT_SHIPPED_CANCELLED, colis LOST, remboursement wallet, annonce réactivée", async () => {
    const seller = await createTestUser(TAG, 1);
    const buyer = await createTestUser(TAG, 2);
    const { variants } = await createTestCatalog(TAG, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 15,
    });

    await creditTestWallet(buyer.id, 40);
    const { saleId } = await createSaleFromListing(buyer.id, listingId);
    await debitWalletForSale({ userId: buyer.id, saleId, amountEur: 15 });
    const shipmentId = await createShipmentForSale(saleId, seller.id);

    // Manipule la deadline J+3 → passée.
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { notShipDeadline: new Date(Date.now() - 60_000) },
    });

    const result = await processSaleTimeouts();
    expect(result.notShipped).toBeGreaterThanOrEqual(1);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("NOT_SHIPPED_CANCELLED");
    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe("LOST");

    // Annonce réactivée pour remise en vente.
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("ACTIVE");

    // Remboursement wallet de l'acheteur (vente financée wallet).
    const buyerWallet = await prisma.walletAccount.findUniqueOrThrow({
      where: { userId: buyer.id },
    });
    expect(Number(buyerWallet.depositBalance)).toBe(40);
    const refund = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { saleId, type: "REFUND" },
    });
    expect(Number(refund.amount)).toBe(15);

    // Paiement annulé (pré-autorisation jamais capturée) + événement de transition.
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId, kind: "PURCHASE" } });
    expect(["CANCELLED", "REFUNDED"]).toContain(payment.status);
    const events = await prisma.transactionEvent.findMany({
      where: { entityType: "SALE", entityId: saleId },
    });
    expect(events.map((e) => e.event)).toContain("NOT_SHIPPED_TIMEOUT");

    // Idempotence : un 2ᵉ passage ne re-traite pas la vente.
    await processSaleTimeouts();
    const refunds = await prisma.walletLedgerEntry.count({ where: { saleId, type: "REFUND" } });
    expect(refunds).toBe(1);
  });

  it("fin de garantie 72 h : COMPLETED auto, carte transférée, paiement RELEASED, payout vendeur", async () => {
    const seller = await createTestUser(TAG, 3);
    const buyer = await createTestUser(TAG, 4);
    const { variants } = await createTestCatalog(`${TAG}b`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 22,
    });

    await creditTestWallet(buyer.id, 30);
    const { saleId } = await createSaleFromListing(buyer.id, listingId);
    await debitWalletForSale({ userId: buyer.id, saleId, amountEur: 22 });
    const shipmentId = await createShipmentForSale(saleId, seller.id);
    await markShipmentShipped(shipmentId, seller.id, "TRK-QA-TO");
    await markShipmentDelivered(shipmentId, buyer.id);

    // Aligne le statut vente (non synchronisé automatiquement — voir bugs.test.ts)
    // puis fait expirer la fenêtre de garantie 72 h.
    await prisma.sale.update({ where: { id: saleId }, data: { status: "DELIVERED_WINDOW" } });
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { guaranteeEndsAt: new Date(Date.now() - 60_000) },
    });

    const result = await processSaleTimeouts();
    expect(result.completed).toBeGreaterThanOrEqual(1);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("COMPLETED");
    expect(sale.completedAt).not.toBeNull();

    // Transfert de la carte vendeur → acheteur.
    const sellerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId: variants[0].id },
    });
    expect(sellerItem.quantity).toBe(0);
    expect(sellerItem.reservedQuantity).toBe(0);
    const buyerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: buyer.id, variantId: variants[0].id },
    });
    expect(buyerItem.quantity).toBe(1);

    // Paiement libéré + gains vendeur.
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId, kind: "PURCHASE" } });
    expect(payment.status).toBe("RELEASED");
    const sellerWallet = await prisma.walletAccount.findUniqueOrThrow({
      where: { userId: seller.id },
    });
    expect(Number(sellerWallet.earnedBalance)).toBe(22);

    const events = await prisma.transactionEvent.findMany({
      where: { entityType: "SALE", entityId: saleId },
    });
    expect(events.map((e) => e.event)).toContain("GUARANTEE_EXPIRED");

    // Idempotence : pas de double payout au 2ᵉ passage.
    await processSaleTimeouts();
    const payouts = await prisma.walletLedgerEntry.count({
      where: { saleId, type: "SALE_PAYOUT" },
    });
    expect(payouts).toBe(1);
    const buyerItemAfter = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: buyer.id, variantId: variants[0].id },
    });
    expect(buyerItemAfter.quantity).toBe(1);
  });

  it("garantie encore active : la vente reste en DELIVERED_WINDOW", async () => {
    const seller = await createTestUser(TAG, 5);
    const buyer = await createTestUser(TAG, 6);
    const { variants } = await createTestCatalog(`${TAG}c`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 9,
    });
    const { saleId } = await createSaleFromListing(buyer.id, listingId);
    const shipmentId = await createShipmentForSale(saleId, seller.id);
    await markShipmentShipped(shipmentId, seller.id, "TRK-QA-OK");
    await markShipmentDelivered(shipmentId, buyer.id); // garantie = +72 h
    await prisma.sale.update({ where: { id: saleId }, data: { status: "DELIVERED_WINDOW" } });

    await processSaleTimeouts();

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("DELIVERED_WINDOW"); // rien ne bouge avant l'échéance
  });
});
