import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  createTestListing,
  cleanupTag,
} from "./_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

describe(`smoke [${TAG}] — harnais d'intégration`, () => {
  it("crée un vendeur, un acheteur, un catalogue et exécute un achat direct simulé jusqu'à PAID", async () => {
    const seller = await createTestUser(TAG, 1);
    const buyer = await createTestUser(TAG, 2);
    const { variants } = await createTestCatalog(TAG);

    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listing = await createTestListing(seller.id, variants[0].id, { price: 12.5 });

    // Stripe désactivé par setup-env → chemin simulé : la vente passe directement à PAID.
    const { saleId } = await createSaleFromListing(buyer.id, listing.id);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("PAID");
    expect(Number(sale.price)).toBe(12.5);

    const updatedListing = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(updatedListing.status).toBe("SOLD");

    // Journal de transition + paiement escrow créés.
    const events = await prisma.transactionEvent.findMany({ where: { entityId: saleId } });
    expect(events.map((e) => e.event)).toContain("PAYMENT_AUTHORIZED");
    const payment = await prisma.payment.findFirstOrThrow({ where: { saleId } });
    expect(payment.status).toBe("AUTHORIZED");
  });

  it("rejette l'auto-achat (SELF_PURCHASE)", async () => {
    const seller = await prisma.user.findFirstOrThrow({
      where: { email: `${TAG}-u1@qa.test` },
    });
    const listing = await prisma.listing.findFirstOrThrow({
      where: { sellerId: seller.id },
    });
    await expect(createSaleFromListing(seller.id, listing.id)).rejects.toThrow(/SELF_PURCHASE|LISTING_UNAVAILABLE/);
  });
});
