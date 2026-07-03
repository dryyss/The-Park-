import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addCollectionItem,
  removeCollectionItem,
  updateCollectionQuantity,
  adjustCollectionCardQuantity,
  adjustCollectionVariantQuantity,
  updateCollectionEdition,
  updateCollectionGrading,
  updateCollectionSignature,
} from "@/server/collection/collection.mutations";
import { publishListing, cancelListing } from "@/server/marketplace/marketplace.mutations";
import { qaTag, createTestUser, createTestCatalog, cleanupTag } from "../_helpers/fixtures";
import { createCustomCatalog, cleanupTagBadges, getItem, countItems } from "./helpers";

const TAG = qaTag();

let user: Awaited<ReturnType<typeof createTestUser>>;
let variants: { id: string }[];

beforeAll(async () => {
  user = await createTestUser(TAG, 1);
  const catalog = await createTestCatalog(TAG, 6);
  variants = catalog.variants;
});

afterAll(async () => {
  await cleanupTagBadges(TAG);
  await cleanupTag(TAG);
});

describe(`collection [${TAG}] — ajout & quantités`, () => {
  it("ajoute une variante avec état et quantité (flags forSale/forTrade à false par défaut)", async () => {
    await addCollectionItem(user.id, variants[0].id, "GOOD", 2);

    const item = await getItem(user.id, variants[0].id, "GOOD");
    expect(item).not.toBeNull();
    expect(item!.quantity).toBe(2);
    expect(item!.condition).toBe("GOOD");
    expect(item!.forSale).toBe(false);
    expect(item!.forTrade).toBe(false);
    expect(item!.reservedQuantity).toBe(0);
  });

  it("ré-ajouter la même (variante, état) incrémente la quantité sans créer de doublon", async () => {
    await addCollectionItem(user.id, variants[0].id, "GOOD", 1);

    const rows = await prisma.collectionItem.findMany({
      where: { userId: user.id, variantId: variants[0].id, condition: "GOOD" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(3);
  });

  it("un état différent crée une ligne distincte (unicité par user/variante/état)", async () => {
    await addCollectionItem(user.id, variants[0].id, "MINT", 1);

    const rows = await prisma.collectionItem.findMany({
      where: { userId: user.id, variantId: variants[0].id },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.condition))).toEqual(new Set(["GOOD", "MINT"]));
  });

  it("la contrainte unique (user, variant, condition) est bien appliquée en base (P2002)", async () => {
    await expect(
      prisma.collectionItem.create({
        data: { userId: user.id, variantId: variants[0].id, condition: "GOOD", quantity: 1 },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("updateCollectionQuantity fixe la quantité, et 0 supprime la ligne", async () => {
    await updateCollectionQuantity(user.id, variants[0].id, 7, "GOOD");
    expect((await getItem(user.id, variants[0].id, "GOOD"))!.quantity).toBe(7);

    await updateCollectionQuantity(user.id, variants[0].id, 0, "MINT");
    expect(await getItem(user.id, variants[0].id, "MINT")).toBeNull();
  });

  it("adjustCollectionVariantQuantity +1/-1 crée, incrémente, décrémente puis supprime", async () => {
    await adjustCollectionVariantQuantity(user.id, variants[1].id, 1);
    expect((await getItem(user.id, variants[1].id, "EXCELLENT"))!.quantity).toBe(1);

    await adjustCollectionVariantQuantity(user.id, variants[1].id, 1);
    expect((await getItem(user.id, variants[1].id, "EXCELLENT"))!.quantity).toBe(2);

    await adjustCollectionVariantQuantity(user.id, variants[1].id, -1);
    expect((await getItem(user.id, variants[1].id, "EXCELLENT"))!.quantity).toBe(1);

    await adjustCollectionVariantQuantity(user.id, variants[1].id, -1);
    expect(await getItem(user.id, variants[1].id, "EXCELLENT")).toBeNull();
  });

  it("adjustCollectionCardQuantity +1/-1 par numéro de carte cible la variante standard", async () => {
    const { cards, variants: v } = await createCustomCatalog(TAG, "adj", {
      cardCount: 1,
      useStandardVersion: true,
    });

    await adjustCollectionCardQuantity(user.id, cards[0].number, 1);
    expect((await getItem(user.id, v[0].id, "EXCELLENT"))!.quantity).toBe(1);

    await adjustCollectionCardQuantity(user.id, cards[0].number, -1);
    expect(await getItem(user.id, v[0].id, "EXCELLENT")).toBeNull();
  });

  it("removeCollectionItem supprime l'exemplaire (non réservé)", async () => {
    await addCollectionItem(user.id, variants[2].id, "FAIR", 1);
    await removeCollectionItem(user.id, variants[2].id, "FAIR");
    expect(await getItem(user.id, variants[2].id, "FAIR")).toBeNull();
  });
});

describe(`collection [${TAG}] — édition, gradation, signature`, () => {
  beforeAll(async () => {
    await addCollectionItem(user.id, variants[2].id, "EXCELLENT", 1);
  });

  it("updateCollectionEdition pose puis efface le libellé d'édition", async () => {
    await updateCollectionEdition(user.id, variants[2].id, "1ère édition", "EXCELLENT");
    expect((await getItem(user.id, variants[2].id, "EXCELLENT"))!.editionLabel).toBe("1ère édition");

    await updateCollectionEdition(user.id, variants[2].id, null, "EXCELLENT");
    expect((await getItem(user.id, variants[2].id, "EXCELLENT"))!.editionLabel).toBeNull();
  });

  it("updateCollectionGrading active la gradation (société + note) puis la retire en purgeant les champs", async () => {
    await updateCollectionGrading(user.id, variants[2].id, "EXCELLENT", {
      isGraded: true,
      gradeCompany: "PSA",
      gradeScore: 9,
    });
    let item = await getItem(user.id, variants[2].id, "EXCELLENT");
    expect(item!.isGraded).toBe(true);
    expect(item!.gradeCompany).toBe("PSA");
    expect(Number(item!.gradeScore)).toBe(9);

    await updateCollectionGrading(user.id, variants[2].id, "EXCELLENT", { isGraded: false });
    item = await getItem(user.id, variants[2].id, "EXCELLENT");
    expect(item!.isGraded).toBe(false);
    expect(item!.gradeCompany).toBeNull();
    expect(item!.gradeScore).toBeNull();
  });

  it("updateCollectionSignature active la signature (auteur trimé) puis la retire", async () => {
    await updateCollectionSignature(user.id, variants[2].id, "EXCELLENT", true, "  Artiste QA  ");
    let item = await getItem(user.id, variants[2].id, "EXCELLENT");
    expect(item!.isSigned).toBe(true);
    expect(item!.signatureAuthor).toBe("Artiste QA");

    await updateCollectionSignature(user.id, variants[2].id, "EXCELLENT", false);
    item = await getItem(user.id, variants[2].id, "EXCELLENT");
    expect(item!.isSigned).toBe(false);
    expect(item!.signatureAuthor).toBeNull();
  });
});

describe(`collection [${TAG}] — réservations (annonces marketplace)`, () => {
  let listingA: string;
  let listingB: string;

  it("publishListing réserve un exemplaire et pose les flags forSale/forTrade", async () => {
    await addCollectionItem(user.id, variants[3].id, "EXCELLENT", 2);
    listingA = await publishListing(user.id, {
      variantId: variants[3].id,
      type: "SELL_OR_TRADE",
      condition: "EXCELLENT",
      price: 15,
    });

    const item = await getItem(user.id, variants[3].id, "EXCELLENT");
    expect(item!.reservedQuantity).toBe(1);
    expect(item!.forSale).toBe(true);
    expect(item!.forTrade).toBe(true);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingA } });
    expect(listing.status).toBe("ACTIVE");
    expect(listing.condition).toBe("EXCELLENT");
    expect(Number(listing.price)).toBe(15);
  });

  it("interdit de retirer un exemplaire réservé (RESERVED) sans modifier la base", async () => {
    await expect(removeCollectionItem(user.id, variants[3].id, "EXCELLENT")).rejects.toThrow("RESERVED");

    const item = await getItem(user.id, variants[3].id, "EXCELLENT");
    expect(item).not.toBeNull();
    expect(item!.quantity).toBe(2);
    expect(item!.reservedQuantity).toBe(1);
  });

  it("interdit de descendre la quantité sous la réservation (BELOW_RESERVED) sans modifier la base", async () => {
    listingB = await publishListing(user.id, {
      variantId: variants[3].id,
      type: "SELL",
      condition: "EXCELLENT",
      price: 20,
    });
    expect((await getItem(user.id, variants[3].id, "EXCELLENT"))!.reservedQuantity).toBe(2);

    await expect(updateCollectionQuantity(user.id, variants[3].id, 1, "EXCELLENT")).rejects.toThrow(
      "BELOW_RESERVED",
    );
    expect((await getItem(user.id, variants[3].id, "EXCELLENT"))!.quantity).toBe(2);

    await expect(adjustCollectionVariantQuantity(user.id, variants[3].id, -1)).rejects.toThrow(
      "BELOW_RESERVED",
    );
    expect((await getItem(user.id, variants[3].id, "EXCELLENT"))!.quantity).toBe(2);
  });

  it("publier plus d'annonces que d'exemplaires disponibles échoue (ALL_RESERVED)", async () => {
    const before = await prisma.listing.count({ where: { sellerId: user.id } });
    await expect(
      publishListing(user.id, { variantId: variants[3].id, type: "SELL", condition: "EXCELLENT", price: 5 }),
    ).rejects.toThrow("ALL_RESERVED");
    expect(await prisma.listing.count({ where: { sellerId: user.id } })).toBe(before);
  });

  it("cancelListing libère la réservation et le retrait redevient possible", async () => {
    await cancelListing(user.id, listingA);
    await cancelListing(user.id, listingB);

    const item = await getItem(user.id, variants[3].id, "EXCELLENT");
    expect(item!.reservedQuantity).toBe(0);

    await removeCollectionItem(user.id, variants[3].id, "EXCELLENT");
    expect(await getItem(user.id, variants[3].id, "EXCELLENT")).toBeNull();
  });
});

describe(`collection [${TAG}] — gestion d'erreurs`, () => {
  it("addCollectionItem sur variante inexistante → VARIANT_NOT_FOUND, base intacte", async () => {
    const before = await countItems(user.id);
    await expect(addCollectionItem(user.id, "variant-inexistant", "MINT", 1)).rejects.toThrow(
      "VARIANT_NOT_FOUND",
    );
    expect(await countItems(user.id)).toBe(before);
  });

  it("removeCollectionItem sur exemplaire non possédé → NOT_FOUND, base intacte", async () => {
    const before = await countItems(user.id);
    await expect(removeCollectionItem(user.id, variants[4].id, "DAMAGED")).rejects.toThrow("NOT_FOUND");
    expect(await countItems(user.id)).toBe(before);
  });

  it("un autre utilisateur ne peut pas retirer/éditer l'exemplaire d'autrui (NOT_FOUND)", async () => {
    const intruder = await createTestUser(TAG, 9);
    await addCollectionItem(user.id, variants[4].id, "EXCELLENT", 1);

    await expect(removeCollectionItem(intruder.id, variants[4].id, "EXCELLENT")).rejects.toThrow("NOT_FOUND");
    await expect(
      updateCollectionEdition(intruder.id, variants[4].id, "1ère édition", "EXCELLENT"),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      updateCollectionGrading(intruder.id, variants[4].id, "EXCELLENT", { isGraded: true }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      updateCollectionSignature(intruder.id, variants[4].id, "EXCELLENT", true, "X"),
    ).rejects.toThrow("NOT_FOUND");

    // La ligne du propriétaire n'a pas bougé.
    const item = await getItem(user.id, variants[4].id, "EXCELLENT");
    expect(item!.quantity).toBe(1);
    expect(item!.editionLabel).toBeNull();
    expect(item!.isGraded).toBe(false);
    expect(item!.isSigned).toBe(false);
  });

  it("adjustCollectionCardQuantity sur numéro inconnu → CARD_NOT_FOUND", async () => {
    await expect(adjustCollectionCardQuantity(user.id, 999_999_000, 1)).rejects.toThrow("CARD_NOT_FOUND");
  });

  it("adjustCollectionVariantQuantity sur variante inexistante → VARIANT_NOT_FOUND", async () => {
    await expect(adjustCollectionVariantQuantity(user.id, "variant-inexistant", 1)).rejects.toThrow(
      "VARIANT_NOT_FOUND",
    );
  });

  it("adjust -1 sur une carte non possédée est un no-op (pas d'erreur, base intacte)", async () => {
    const before = await countItems(user.id);
    await adjustCollectionVariantQuantity(user.id, variants[5].id, -1);
    expect(await countItems(user.id)).toBe(before);
  });

  it("publishListing sans posséder la variante → NOT_OWNED, aucune annonce créée", async () => {
    const seller2 = await createTestUser(TAG, 8);
    const before = await prisma.listing.count({ where: { sellerId: seller2.id } });
    await expect(
      publishListing(seller2.id, { variantId: variants[0].id, type: "SELL", price: 3 }),
    ).rejects.toThrow("NOT_OWNED");
    expect(await prisma.listing.count({ where: { sellerId: seller2.id } })).toBe(before);
  });

  // BUG: addCollectionItem n'a aucune validation de quantité — une quantité négative ou nulle
  // est acceptée telle quelle (création d'une ligne quantity <= 0, ou décrément arbitraire via
  // l'incrément d'upsert, y compris sous reservedQuantity). La validation n'existe que dans la
  // server action (zod min(1)) : tout autre appelant du service peut corrompre la collection.
  // Fichier : src/server/collection/collection.mutations.ts:6-21.
  it.fails("BUG — addCollectionItem devrait rejeter une quantité négative", async () => {
    await expect(addCollectionItem(user.id, variants[5].id, "DAMAGED", -3)).rejects.toThrow();
  });

  // BUG: updateCollectionQuantity fait un upsert sans vérifier l'existence de la variante :
  // sur un variantId inexistant, l'appel remonte une erreur Prisma brute P2003 (violation FK)
  // au lieu d'un code métier VARIANT_NOT_FOUND comme addCollectionItem.
  // Fichier : src/server/collection/collection.mutations.ts:39-62.
  it.fails("BUG — updateCollectionQuantity sur variante inexistante devrait donner une erreur métier", async () => {
    await expect(updateCollectionQuantity(user.id, "variant-inexistant", 2, "MINT")).rejects.toThrow(
      /VARIANT_NOT_FOUND/,
    );
  });
});
