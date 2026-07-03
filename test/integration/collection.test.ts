import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addCollectionItem,
  removeCollectionItem,
  updateCollectionQuantity,
} from "@/server/collection/collection.mutations";
import { addWishlistItem, removeWishlistItem } from "@/server/wishlist/wishlist.mutations";
import { requestParentalConsent, verifyParentalConsent } from "@/server/user/parental-consent.service";
import { exportUserData } from "@/server/user/account.service";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  cleanupTag,
} from "./_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

describe(`collection [${TAG}]`, () => {
  it("ajoute puis incrémente un exemplaire (upsert)", async () => {
    const user = await createTestUser(TAG, 1);
    const { variants } = await createTestCatalog(TAG);

    await addCollectionItem(user.id, variants[0].id, "EXCELLENT", 1);
    await addCollectionItem(user.id, variants[0].id, "EXCELLENT", 2);

    const item = await prisma.collectionItem.findUniqueOrThrow({
      where: {
        userId_variantId_condition: {
          userId: user.id,
          variantId: variants[0].id,
          condition: "EXCELLENT",
        },
      },
    });
    expect(item.quantity).toBe(3);
  });

  it("refuse d'ajouter une variante inexistante (VARIANT_NOT_FOUND)", async () => {
    const user = await createTestUser(TAG, 2);
    await expect(addCollectionItem(user.id, "does-not-exist", "EXCELLENT", 1)).rejects.toThrow(
      "VARIANT_NOT_FOUND",
    );
  });

  it("refuse de retirer/réduire sous la quantité réservée", async () => {
    const user = await createTestUser(TAG, 3);
    const { variants } = await createTestCatalog(TAG, 2);
    await addToCollection(user.id, variants[0].id, { quantity: 2 });
    // Réserve 1 exemplaire (comme le ferait une annonce/enchère).
    await prisma.collectionItem.updateMany({
      where: { userId: user.id, variantId: variants[0].id, condition: "EXCELLENT" },
      data: { reservedQuantity: 1 },
    });

    await expect(removeCollectionItem(user.id, variants[0].id, "EXCELLENT")).rejects.toThrow("RESERVED");
    await expect(updateCollectionQuantity(user.id, variants[0].id, 0, "EXCELLENT")).rejects.toThrow(
      "RESERVED",
    );
  });

  it("updateCollectionQuantity avec 0 supprime l'exemplaire non réservé", async () => {
    const user = await createTestUser(TAG, 4);
    const { variants } = await createTestCatalog(TAG);
    await addToCollection(user.id, variants[0].id, { quantity: 1 });

    await updateCollectionQuantity(user.id, variants[0].id, 0, "EXCELLENT");

    const item = await prisma.collectionItem.findUnique({
      where: {
        userId_variantId_condition: {
          userId: user.id,
          variantId: variants[0].id,
          condition: "EXCELLENT",
        },
      },
    });
    expect(item).toBeNull();
  });
});

describe(`wishlist [${TAG}]`, () => {
  it("ajoute un item puis le retire", async () => {
    const user = await createTestUser(TAG, 5);
    const { cards, variants, season } = await createTestCatalog(TAG);

    const wishId = await addWishlistItem(user.id, {
      cardId: cards[0].id,
      variantId: variants[0].id,
      seasonId: season.id,
      condition: "EXCELLENT",
      editionPreset: "unlimited",
    });
    expect(wishId).toBeTruthy();

    await removeWishlistItem(user.id, wishId);
    const count = await prisma.wishlistItem.count({ where: { id: wishId } });
    expect(count).toBe(0);
  });

  it("refuse un mismatch carte/saison (SEASON_MISMATCH)", async () => {
    const user = await createTestUser(TAG, 6);
    const { cards, variants } = await createTestCatalog(TAG);
    await expect(
      addWishlistItem(user.id, {
        cardId: cards[0].id,
        variantId: variants[0].id,
        seasonId: "wrong-season",
        condition: "EXCELLENT",
        editionPreset: "unlimited",
      }),
    ).rejects.toThrow("SEASON_MISMATCH");
  });

  it("refuse de retirer l'item d'autrui (NOT_FOUND — isolation par userId)", async () => {
    const owner = await createTestUser(TAG, 7);
    const attacker = await createTestUser(TAG, 8);
    const { cards, variants, season } = await createTestCatalog(TAG);
    const wishId = await addWishlistItem(owner.id, {
      cardId: cards[0].id,
      variantId: variants[0].id,
      seasonId: season.id,
      condition: "EXCELLENT",
      editionPreset: "unlimited",
    });
    await expect(removeWishlistItem(attacker.id, wishId)).rejects.toThrow("NOT_FOUND");
    // L'item de la victime existe toujours.
    expect(await prisma.wishlistItem.count({ where: { id: wishId } })).toBe(1);
  });
});

describe(`RGPD & protection des mineurs [${TAG}]`, () => {
  it("consentement parental : PENDING_VERIFICATION → ACTIVE après vérif du token", async () => {
    const minor = await createTestUser(TAG, 9, { status: "PENDING_VERIFICATION" });

    const { token } = await requestParentalConsent(minor.id, "parent@qa.test", "Parent QA");
    expect(token).toHaveLength(48);

    const ok = await verifyParentalConsent(token);
    expect(ok).toBe(true);

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: minor.id } });
    expect(refreshed.status).toBe("ACTIVE");
  });

  it("token de consentement invalide → false (pas d'activation)", async () => {
    const ok = await verifyParentalConsent("token-bidon-inexistant");
    expect(ok).toBe(false);
  });

  it("export RGPD renvoie les données personnelles de l'utilisateur", async () => {
    const user = await createTestUser(TAG, 10);
    const { variants } = await createTestCatalog(TAG);
    await addToCollection(user.id, variants[0].id, { quantity: 1 });

    const data = await exportUserData(user.id);
    expect(data).toMatchObject({ user: { email: `${TAG}-u10@qa.test` } });
    expect(JSON.stringify(data)).toContain(variants[0].id);
  });
});
