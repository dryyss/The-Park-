import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  publishListing,
  pauseListing,
  resumeListing,
  cancelListing,
  expireDueListings,
} from "@/server/marketplace/marketplace.mutations";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  cleanupTag,
} from "../_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

describe(`annonces [${TAG}] — création / réservation / retrait / expiration`, () => {
  it("publishListing réserve le stock du vendeur et crée une annonce ACTIVE", async () => {
    const seller = await createTestUser(TAG, 1);
    const { variants } = await createTestCatalog(TAG, 1);
    const item = await addToCollection(seller.id, variants[0].id, { quantity: 2 });

    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 25,
    });

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("ACTIVE");
    expect(listing.type).toBe("SELL");
    expect(Number(listing.price)).toBe(25);
    expect(listing.condition).toBe("EXCELLENT"); // hérité de l'item de collection
    expect(listing.expiresAt).not.toBeNull();
    expect(listing.expiresAt!.getTime()).toBeGreaterThan(Date.now());

    const updated = await prisma.collectionItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.reservedQuantity).toBe(1);
    expect(updated.forSale).toBe(true);
  });

  it("publishListing rejette NOT_OWNED (variante non possédée)", async () => {
    const stranger = await createTestUser(TAG, 2);
    const { variants } = await createTestCatalog(`${TAG}b`, 1);
    // Rattache le catalogue secondaire au tag principal pour le cleanup :
    // les codes commencent par QA-<TAG>b donc startsWith QA-<TAG> les couvre.
    await expect(
      publishListing(stranger.id, { variantId: variants[0].id, type: "SELL", price: 5 }),
    ).rejects.toThrow("NOT_OWNED");

    const count = await prisma.listing.count({ where: { sellerId: stranger.id } });
    expect(count).toBe(0);
  });

  it("publishListing rejette ALL_RESERVED quand tout le stock est déjà réservé", async () => {
    const seller = await createTestUser(TAG, 3);
    const { variants } = await createTestCatalog(`${TAG}c`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });

    await publishListing(seller.id, { variantId: variants[0].id, type: "SELL", price: 9 });
    await expect(
      publishListing(seller.id, { variantId: variants[0].id, type: "SELL", price: 9 }),
    ).rejects.toThrow("ALL_RESERVED");

    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId: variants[0].id },
    });
    expect(item.reservedQuantity).toBe(1); // pas de sur-réservation
  });

  it("cancelListing (retrait) libère la réservation de l'état concerné", async () => {
    const seller = await createTestUser(TAG, 4);
    const { variants } = await createTestCatalog(`${TAG}d`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });

    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 7,
    });
    await cancelListing(seller.id, listingId);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("CANCELLED");
    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId: variants[0].id },
    });
    expect(item.reservedQuantity).toBe(0);
  });

  it("cancelListing par un autre utilisateur rejette NOT_FOUND sans toucher l'annonce", async () => {
    const seller = await createTestUser(TAG, 5);
    const other = await createTestUser(TAG, 6);
    const { variants } = await createTestCatalog(`${TAG}e`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 7,
    });

    await expect(cancelListing(other.id, listingId)).rejects.toThrow("NOT_FOUND");
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("ACTIVE");
  });

  it("pause / reprise d'une annonce", async () => {
    const seller = await createTestUser(TAG, 7);
    const { variants } = await createTestCatalog(`${TAG}f`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 7,
    });

    await pauseListing(seller.id, listingId);
    expect(
      (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status,
    ).toBe("PAUSED");

    await resumeListing(seller.id, listingId);
    expect(
      (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status,
    ).toBe("ACTIVE");
  });

  it("expireDueListings expire l'annonce échue et libère la réservation (cas nominal : un seul état)", async () => {
    const seller = await createTestUser(TAG, 8);
    const { variants } = await createTestCatalog(`${TAG}g`, 1);
    await addToCollection(seller.id, variants[0].id, { quantity: 1 });
    const listingId = await publishListing(seller.id, {
      variantId: variants[0].id,
      type: "SELL",
      price: 7,
    });

    await prisma.listing.update({
      where: { id: listingId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const count = await expireDueListings();
    expect(count).toBeGreaterThanOrEqual(1);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("EXPIRED");

    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId: variants[0].id },
    });
    expect(item.reservedQuantity).toBe(0);
    expect(item.forSale).toBe(false);
  });
});
