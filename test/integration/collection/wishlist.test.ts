import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { addWishlistItem, removeWishlistItem } from "@/server/wishlist/wishlist.mutations";
import { getViewerWishlist, getViewerWishlistCardIds } from "@/server/wishlist/wishlist.service";
import { notifyWishlistForNewListing } from "@/server/marketplace/wishlist-listing-notify";
import { publishListing } from "@/server/marketplace/marketplace.mutations";
import { addCollectionItem } from "@/server/collection/collection.mutations";
import { qaTag, createTestUser, createTestCatalog, cleanupTag } from "../_helpers/fixtures";
import { cleanupTagBadges } from "./helpers";

const TAG = qaTag();

let seller: Awaited<ReturnType<typeof createTestUser>>;
let wisher: Awaited<ReturnType<typeof createTestUser>>;
let catalog: Awaited<ReturnType<typeof createTestCatalog>>;

const countWishlist = (userId: string) => prisma.wishlistItem.count({ where: { userId } });

beforeAll(async () => {
  seller = await createTestUser(TAG, 1);
  wisher = await createTestUser(TAG, 2);
  catalog = await createTestCatalog(TAG, 2);
});

afterAll(async () => {
  await cleanupTagBadges(TAG);
  await cleanupTag(TAG);
});

describe(`wishlist [${TAG}] — ajout & retrait`, () => {
  let firstItemId: string;

  it("ajoute une entrée (carte + variante + saison + état + édition)", async () => {
    firstItemId = await addWishlistItem(wisher.id, {
      cardId: catalog.cards[0].id,
      variantId: catalog.variants[0].id,
      seasonId: catalog.season.id,
      condition: "EXCELLENT",
      editionPreset: "unlimited",
    });

    const row = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: firstItemId } });
    expect(row.userId).toBe(wisher.id);
    expect(row.cardId).toBe(catalog.cards[0].id);
    expect(row.variantId).toBe(catalog.variants[0].id);
    expect(row.seasonId).toBe(catalog.season.id);
    expect(row.condition).toBe("EXCELLENT");
    expect(row.editionPreset).toBe("unlimited");
    expect(row.note).toBeNull();
  });

  it("le doublon exact ne crée pas de seconde ligne (upsert : même id, note mise à jour)", async () => {
    const id = await addWishlistItem(wisher.id, {
      cardId: catalog.cards[0].id,
      variantId: catalog.variants[0].id,
      seasonId: catalog.season.id,
      condition: "EXCELLENT",
      editionPreset: "unlimited",
      note: "graal",
    });

    expect(id).toBe(firstItemId);
    expect(await countWishlist(wisher.id)).toBe(1);
    const row = await prisma.wishlistItem.findUniqueOrThrow({ where: { id } });
    expect(row.note).toBe("graal");
  });

  it("un état ou une édition différents créent des lignes distinctes", async () => {
    const idMint = await addWishlistItem(wisher.id, {
      cardId: catalog.cards[0].id,
      variantId: catalog.variants[0].id,
      seasonId: catalog.season.id,
      condition: "MINT",
      editionPreset: "unlimited",
    });
    const idFirst = await addWishlistItem(wisher.id, {
      cardId: catalog.cards[0].id,
      variantId: catalog.variants[0].id,
      seasonId: catalog.season.id,
      condition: "EXCELLENT",
      editionPreset: "first",
    });

    expect(new Set([firstItemId, idMint, idFirst]).size).toBe(3);
    expect(await countWishlist(wisher.id)).toBe(3);
  });

  it("getViewerWishlist retourne des fiches cohérentes avec le catalogue", async () => {
    const view = await getViewerWishlist(wisher.id);
    expect(view).toHaveLength(3);

    for (const w of view) {
      expect(w.cardId).toBe(catalog.cards[0].id);
      expect(w.name).toBe(catalog.cards[0].name);
      expect(w.number).toBe(catalog.cards[0].number);
      expect(w.slug).toBe(catalog.cards[0].slug);
      expect(w.seasonCode).toBe(catalog.season.code);
      expect(w.seasonName).toBe(catalog.season.name);
    }

    const first = view.find((w) => w.isFirstEdition);
    expect(first).toBeDefined();
    expect(first!.editionLabel).toBe("1ère édition");

    const unlimited = view.filter((w) => !w.isFirstEdition);
    expect(unlimited).toHaveLength(2);
    for (const w of unlimited) expect(w.editionLabel).toBeNull();
  });

  it("getViewerWishlistCardIds déduplique par carte", async () => {
    const ids = await getViewerWishlistCardIds(wisher.id);
    expect(ids).toEqual([catalog.cards[0].id]);
  });

  it("removeWishlistItem supprime la ligne du propriétaire", async () => {
    const before = await countWishlist(wisher.id);
    await removeWishlistItem(wisher.id, firstItemId);
    expect(await countWishlist(wisher.id)).toBe(before - 1);
    expect(await prisma.wishlistItem.findUnique({ where: { id: firstItemId } })).toBeNull();
  });
});

describe(`wishlist [${TAG}] — gestion d'erreurs`, () => {
  it("variante inexistante → VARIANT_NOT_FOUND, base intacte", async () => {
    const before = await countWishlist(wisher.id);
    await expect(
      addWishlistItem(wisher.id, {
        cardId: catalog.cards[0].id,
        variantId: "variant-inexistant",
        seasonId: catalog.season.id,
        condition: "EXCELLENT",
        editionPreset: "unlimited",
      }),
    ).rejects.toThrow("VARIANT_NOT_FOUND");
    expect(await countWishlist(wisher.id)).toBe(before);
  });

  it("variante n'appartenant pas à la carte → VARIANT_NOT_FOUND, base intacte", async () => {
    const before = await countWishlist(wisher.id);
    await expect(
      addWishlistItem(wisher.id, {
        cardId: catalog.cards[0].id,
        variantId: catalog.variants[1].id, // variante de la carte 2
        seasonId: catalog.season.id,
        condition: "EXCELLENT",
        editionPreset: "unlimited",
      }),
    ).rejects.toThrow("VARIANT_NOT_FOUND");
    expect(await countWishlist(wisher.id)).toBe(before);
  });

  it("saison incohérente avec la carte → SEASON_MISMATCH, base intacte", async () => {
    const otherSeason = await prisma.season.create({
      data: { code: `QA-${TAG}-s2`, name: `QA Season ${TAG} bis` },
    });
    const before = await countWishlist(wisher.id);
    await expect(
      addWishlistItem(wisher.id, {
        cardId: catalog.cards[0].id,
        variantId: catalog.variants[0].id,
        seasonId: otherSeason.id,
        condition: "EXCELLENT",
        editionPreset: "unlimited",
      }),
    ).rejects.toThrow("SEASON_MISMATCH");
    expect(await countWishlist(wisher.id)).toBe(before);
  });

  it("retrait d'une entrée d'autrui ou inexistante → NOT_FOUND, base intacte", async () => {
    const foreign = await addWishlistItem(wisher.id, {
      cardId: catalog.cards[1].id,
      variantId: catalog.variants[1].id,
      seasonId: catalog.season.id,
      condition: "GOOD",
      editionPreset: "unlimited",
    });

    await expect(removeWishlistItem(seller.id, foreign)).rejects.toThrow("NOT_FOUND");
    expect(await prisma.wishlistItem.findUnique({ where: { id: foreign } })).not.toBeNull();

    await expect(removeWishlistItem(wisher.id, "wishlist-inexistant")).rejects.toThrow("NOT_FOUND");
  });
});

describe(`wishlist [${TAG}] — notification à la mise en vente`, () => {
  it("publier une annonce notifie les membres qui recherchent la carte (une seule fois), pas le vendeur", async () => {
    // Le wisher a déjà 2 entrées wishlist sur la carte 1 (MINT + first) → une seule notif attendue.
    // Un membre ayant désactivé les préférences "exchanges" ne doit pas être notifié.
    const muted = await createTestUser(TAG, 3, {
      notificationPrefs: { exchanges: false, messages: true, auctions: true, orders: true, marketing: false },
    });
    await addWishlistItem(muted.id, {
      cardId: catalog.cards[0].id,
      variantId: catalog.variants[0].id,
      seasonId: catalog.season.id,
      condition: "EXCELLENT",
      editionPreset: "unlimited",
    });
    // Le vendeur recherche aussi sa propre carte : il ne doit pas s'auto-notifier.
    await addWishlistItem(seller.id, {
      cardId: catalog.cards[0].id,
      variantId: catalog.variants[0].id,
      seasonId: catalog.season.id,
      condition: "EXCELLENT",
      editionPreset: "unlimited",
    });

    await addCollectionItem(seller.id, catalog.variants[0].id, "EXCELLENT", 1);
    const listingId = await publishListing(seller.id, {
      variantId: catalog.variants[0].id,
      type: "SELL",
      condition: "EXCELLENT",
      price: 25,
    });

    const notifs = await prisma.notification.findMany({
      where: { type: "WISHLIST_LISTING", entityId: listingId },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].userId).toBe(wisher.id);
    expect(notifs[0].actorId).toBe(seller.id);
    expect(notifs[0].payload).toMatchObject({
      cardName: catalog.cards[0].name,
      cardSlug: catalog.cards[0].slug,
    });
  });

  it("notifyWishlistForNewListing sur variante inexistante est un no-op silencieux", async () => {
    await expect(
      notifyWishlistForNewListing(`listing-x-${TAG}`, seller.id, "variant-inexistant"),
    ).resolves.toBeUndefined();
    expect(
      await prisma.notification.count({ where: { type: "WISHLIST_LISTING", entityId: `listing-x-${TAG}` } }),
    ).toBe(0);
  });
});
