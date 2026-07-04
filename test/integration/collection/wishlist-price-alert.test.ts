import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { addWishlistItem, setWishlistItemAlertPrice } from "@/server/wishlist/wishlist.mutations";
import { publishListing } from "@/server/marketplace/marketplace.mutations";
import { addCollectionItem } from "@/server/collection/collection.mutations";
import { qaTag, createTestUser, createTestCatalog, cleanupTag } from "../_helpers/fixtures";
import { cleanupTagBadges } from "./helpers";

const TAG = qaTag();

let seller: Awaited<ReturnType<typeof createTestUser>>;
let wisherAlert: Awaited<ReturnType<typeof createTestUser>>;
let wisherPlain: Awaited<ReturnType<typeof createTestUser>>;
let catalog: Awaited<ReturnType<typeof createTestCatalog>>;

beforeAll(async () => {
  seller = await createTestUser(TAG, 1);
  wisherAlert = await createTestUser(TAG, 2);
  wisherPlain = await createTestUser(TAG, 3);
  catalog = await createTestCatalog(TAG, 1);

  // wisherAlert : seuil d'alerte à 20 € ; wisherPlain : alerte de disponibilité simple.
  const alertItemId = await addWishlistItem(wisherAlert.id, {
    cardId: catalog.cards[0].id,
    variantId: catalog.variants[0].id,
    seasonId: catalog.season.id,
    condition: "EXCELLENT",
    editionPreset: "unlimited",
  });
  await setWishlistItemAlertPrice(wisherAlert.id, alertItemId, 20);

  await addWishlistItem(wisherPlain.id, {
    cardId: catalog.cards[0].id,
    variantId: catalog.variants[0].id,
    seasonId: catalog.season.id,
    condition: "EXCELLENT",
    editionPreset: "unlimited",
  });

  // Le vendeur possède 3 exemplaires (une réservation par annonce).
  await addCollectionItem(seller.id, catalog.variants[0].id, "EXCELLENT", 3);
});

afterAll(async () => {
  await cleanupTagBadges(TAG);
  await cleanupTag(TAG);
});

describe(`wishlist alerte prix [${TAG}]`, () => {
  it("annonce AU-DESSUS du seuil : pas d'alerte prix, mais disponibilité pour l'alerte simple", async () => {
    const listingId = await publishListing(seller.id, {
      variantId: catalog.variants[0].id,
      type: "SELL",
      condition: "EXCELLENT",
      price: 30,
    });

    // wisherAlert (seuil 20 €) ne doit PAS être notifié pour une annonce à 30 €.
    const priceDrop = await prisma.notification.count({
      where: { type: "WISHLIST_PRICE_DROP", entityId: listingId, userId: wisherAlert.id },
    });
    expect(priceDrop).toBe(0);
    const alertAvailability = await prisma.notification.count({
      where: { type: "WISHLIST_LISTING", entityId: listingId, userId: wisherAlert.id },
    });
    expect(alertAvailability).toBe(0);

    // wisherPlain (sans seuil) reçoit la disponibilité.
    const availability = await prisma.notification.findMany({
      where: { type: "WISHLIST_LISTING", entityId: listingId, userId: wisherPlain.id },
    });
    expect(availability).toHaveLength(1);
  });

  it("annonce SOUS le seuil : alerte prix ciblée avec payload prix + seuil", async () => {
    const listingId = await publishListing(seller.id, {
      variantId: catalog.variants[0].id,
      type: "SELL",
      condition: "EXCELLENT",
      price: 15,
    });

    const priceDrop = await prisma.notification.findMany({
      where: { type: "WISHLIST_PRICE_DROP", entityId: listingId, userId: wisherAlert.id },
    });
    expect(priceDrop).toHaveLength(1);
    expect(priceDrop[0].payload).toMatchObject({
      cardName: catalog.cards[0].name,
      cardSlug: catalog.cards[0].slug,
    });
    const payload = priceDrop[0].payload as Record<string, unknown>;
    expect(String(payload.price)).toContain("15");
    expect(String(payload.alertPrice)).toContain("20");

    // wisherPlain reçoit toujours une disponibilité (pas de seuil).
    const availability = await prisma.notification.count({
      where: { type: "WISHLIST_LISTING", entityId: listingId, userId: wisherPlain.id },
    });
    expect(availability).toBe(1);
  });
});
