import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { AsyncLocalStorage } from "node:async_hooks";

// unstable_cache (getSeasonCards, getCatalogSummary…) exige le runtime Next :
// - un AsyncLocalStorage global (capturé par next/dist/server/app-render/async-local-storage
//   au chargement du module → à poser AVANT d'importer catalog.service, d'où l'import dynamique) ;
// - un incrementalCache global : on branche un cache no-op (toujours frais) pour exécuter
//   les vrais chemins de lecture sans serveur Next.
(globalThis as Record<string, unknown>).AsyncLocalStorage = AsyncLocalStorage;
(globalThis as Record<string, unknown>).__incrementalCache = {
  isOnDemandRevalidate: false,
  generateCacheKey: async (key: string) => key,
  get: async () => null,
  set: async () => undefined,
};

type CatalogService = typeof import("@/server/catalog/catalog.service");
let catalogService: CatalogService;
import {
  getUserCollection,
  getUserOwnedCountByRarity,
  getViewerOwnedCardNumbers,
  getUserCompletion,
} from "@/server/collection/collection.service";
import {
  qaTag,
  createTestUser,
  addToCollection,
  createTestListing,
  cleanupTag,
} from "../_helpers/fixtures";
import { createCustomCatalog, cleanupTagBadges } from "./helpers";

const TAG = qaTag();

let owner: Awaited<ReturnType<typeof createTestUser>>;
let sellerB: Awaited<ReturnType<typeof createTestUser>>;
let catalog: Awaited<ReturnType<typeof createCustomCatalog>>;
let activeListingId: string;

beforeAll(async () => {
  // Import différé : après la mise en place des globals Next (voir en-tête).
  catalogService = await import("@/server/catalog/catalog.service");

  owner = await createTestUser(TAG, 1);
  sellerB = await createTestUser(TAG, 2);

  // 3 cartes de rareté "c" (rangée dans les vues produit), version "standard".
  catalog = await createCustomCatalog(TAG, "cat", {
    cardCount: 3,
    sharedRarityCode: "c",
    useStandardVersion: true,
  });

  // owner possède : carte 1 (2× EXCELLENT + 1× MINT) et carte 2 (1× EXCELLENT). Carte 3 manquante.
  await addToCollection(owner.id, catalog.variants[0].id, { condition: "EXCELLENT", quantity: 2 });
  await addToCollection(owner.id, catalog.variants[0].id, { condition: "MINT", quantity: 1 });
  await addToCollection(owner.id, catalog.variants[1].id, { condition: "EXCELLENT", quantity: 1 });

  // Un autre membre vend la carte 1 (annonce active) + une annonce WANT qui ne doit pas apparaître.
  await addToCollection(sellerB.id, catalog.variants[0].id, { quantity: 2 });
  const listing = await createTestListing(sellerB.id, catalog.variants[0].id, { price: 12.5 });
  activeListingId = listing.id;
  await createTestListing(sellerB.id, catalog.variants[0].id, { type: "WANT" });
});

afterAll(async () => {
  await cleanupTagBadges(TAG);
  await cleanupTag(TAG);
});

describe(`catalogue [${TAG}] — fiche carte (getCardDetail)`, () => {
  it("retourne la fiche complète par slug : saison, rareté, navigation prev/next", async () => {
    const detail = await catalogService.getCardDetail(catalog.cards[1].slug);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(catalog.cards[1].id);
    expect(detail!.name).toBe(catalog.cards[1].name);
    expect(detail!.number).toBe(catalog.cards[1].number);
    expect(detail!.seasonId).toBe(catalog.season.id);
    expect(detail!.seasonCode).toBe(catalog.season.code);
    expect(detail!.rarityCode).toBe("c");
    expect(detail!.prevSlug).toBe(catalog.cards[0].slug);
    expect(detail!.nextSlug).toBe(catalog.cards[2].slug);
  });

  it("sans viewer : versions présentes mais rien de possédé", async () => {
    const detail = await catalogService.getCardDetail(catalog.cards[0].slug);
    expect(detail!.versions).toHaveLength(1);
    expect(detail!.versions[0].variantId).toBe(catalog.variants[0].id);
    expect(detail!.versions[0].code).toBe("standard");
    expect(detail!.versions[0].owned).toBe(false);
    expect(detail!.versions[0].quantity).toBe(0);
    expect(detail!.versions[0].conditions).toEqual([]);
  });

  it("avec viewer : quantités agrégées et détail par état trié (MINT avant EXCELLENT)", async () => {
    const detail = await catalogService.getCardDetail(catalog.cards[0].slug, owner.id);
    const version = detail!.versions[0];
    expect(version.owned).toBe(true);
    expect(version.quantity).toBe(3);
    expect(version.reservedQuantity).toBe(0);
    expect(version.availableQuantity).toBe(3);
    expect(version.conditions.map((c) => c.condition)).toEqual(["MINT", "EXCELLENT"]);
    expect(version.conditions.map((c) => c.quantity)).toEqual([1, 2]);
    expect(version.conditions.every((c) => c.available === c.quantity)).toBe(true);
  });

  it("liste les annonces actives de la carte (hors annonces WANT)", async () => {
    const detail = await catalogService.getCardDetail(catalog.cards[0].slug);
    const ids = detail!.listings.map((l) => l.id);
    expect(ids).toContain(activeListingId);

    const mine = detail!.listings.find((l) => l.id === activeListingId)!;
    expect(mine.sellerId).toBe(sellerB.id);
    expect(mine.sellerName).toBe(sellerB.displayName);
    expect(mine.versionLabel).toBe("Standard");
    expect(mine.conditionCode).toBe("EXCELLENT");

    // L'annonce WANT du même vendeur ne doit pas apparaître.
    const wantCount = detail!.listings.filter((l) => l.sellerId === sellerB.id).length;
    expect(wantCount).toBe(1);
  });

  it("slug inconnu → null (pas d'exception)", async () => {
    await expect(catalogService.getCardDetail(`slug-inexistant-${TAG}`)).resolves.toBeNull();
  });
});

describe(`catalogue [${TAG}] — recherche (searchCards)`, () => {
  const q = `QA ${TAG} cat`;

  it("recherche texte : retourne les cartes du tag triées par numéro", async () => {
    const hits = await catalogService.searchCards({ q });
    expect(hits.map((h) => h.slug)).toEqual(catalog.cards.map((c) => c.slug));
    expect(hits[0].rarityLabel).toBeTruthy();
  });

  it("recherche par numéro exact de carte", async () => {
    const hits = await catalogService.searchCards({ q: String(catalog.cards[0].number) });
    expect(hits.map((h) => h.slug)).toContain(catalog.cards[0].slug);
  });

  it("facettes rareté + version combinées au texte", async () => {
    const byRarity = await catalogService.searchCards({ q, rarity: "c" });
    expect(byRarity).toHaveLength(3);

    const byVersion = await catalogService.searchCards({ q, version: "standard" });
    expect(byVersion).toHaveLength(3);

    const noMatch = await catalogService.searchCards({ q, rarity: `QA-${TAG}-inconnue` });
    expect(noMatch).toEqual([]);
  });

  it("tri par nom et limite respectés", async () => {
    const hits = await catalogService.searchCards({ q, sort: "name", limit: 2 });
    expect(hits).toHaveLength(2);
    expect(hits[0].name.localeCompare(hits[1].name)).toBeLessThanOrEqual(0);
  });

  it("sans terme ni facette → tableau vide (état d'accueil)", async () => {
    await expect(catalogService.searchCards({})).resolves.toEqual([]);
  });
});

describe(`catalogue [${TAG}] — lectures saison (getSeasonCards / getCatalogSummary)`, () => {
  it("getSeasonCards retourne le catalogue de la saison, avec quantités du viewer", async () => {
    const rows = await catalogService.getSeasonCards(catalog.season.code, owner.id);
    expect(rows.map((r) => r.slug)).toEqual(catalog.cards.map((c) => c.slug));
    expect(rows[0].standardVariantId).toBe(catalog.variants[0].id);
    expect(rows.map((r) => r.quantity)).toEqual([3, 1, 0]);
  });

  it("getSeasonCards sans viewer : quantités à zéro ; saison inconnue : vide", async () => {
    const rows = await catalogService.getSeasonCards(catalog.season.code);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.quantity === 0)).toBe(true);

    await expect(catalogService.getSeasonCards(`QA-${TAG}-saison-inconnue`)).resolves.toEqual([]);
  });

  it("getCatalogSummary agrège la saison par rareté ; saison inconnue → season null", async () => {
    const summary = await catalogService.getCatalogSummary(catalog.season.code);
    expect(summary.season?.id).toBe(catalog.season.id);
    expect(summary.totalCards).toBe(3);
    const rarityRow = summary.byRarity.find((r) => r.code === "c");
    expect(rarityRow?.count).toBe(3);

    const missing = await catalogService.getCatalogSummary(`QA-${TAG}-saison-inconnue`);
    expect(missing.season).toBeNull();
    expect(missing.totalCards).toBe(0);
  });
});

describe(`catalogue [${TAG}] — classeur (getUserCollection & lectures dérivées)`, () => {
  it("segment 'all' : possession, quantités et pastilles de version cohérentes", async () => {
    const view = await getUserCollection(owner.id, { segment: "all", q: TAG });
    const section = view.sections.find((s) => s.code === "c");
    expect(section).toBeDefined();
    expect(section!.cards).toHaveLength(3);

    const byNumber = new Map(section!.cards.map((c) => [c.number, c]));
    const c1 = byNumber.get(catalog.cards[0].number)!;
    expect(c1.owned).toBe(true);
    expect(c1.quantity).toBe(3);
    expect(c1.standardVariantId).toBe(catalog.variants[0].id);
    expect(c1.dots).toEqual([{ code: "standard", owned: true }]);

    const c3 = byNumber.get(catalog.cards[2].number)!;
    expect(c3.owned).toBe(false);
    expect(c3.quantity).toBe(0);
    expect(c3.dots).toEqual([{ code: "standard", owned: false }]);
  });

  it("segments 'owned' / 'missing' filtrent correctement", async () => {
    const owned = await getUserCollection(owner.id, { segment: "owned", q: TAG });
    const ownedCards = owned.sections.flatMap((s) => s.cards);
    expect(ownedCards.map((c) => c.number).sort()).toEqual(
      [catalog.cards[0].number, catalog.cards[1].number].sort(),
    );

    const missing = await getUserCollection(owner.id, { segment: "missing", q: TAG });
    const missingCards = missing.sections.flatMap((s) => s.cards);
    expect(missingCards.map((c) => c.number)).toEqual([catalog.cards[2].number]);
  });

  it("les taux par saison reflètent la complétion (2/3 possédées → 67 %)", async () => {
    const view = await getUserCollection(owner.id, { segment: "all", q: TAG });
    const season = view.seasonPcts.find((s) => s.code === catalog.season.code);
    expect(season).toBeDefined();
    expect(season!.total).toBe(3);
    expect(season!.owned).toBe(2);
    expect(season!.pct).toBe(67);
  });

  it("visiteur (userId null) : tout est manquant", async () => {
    const view = await getUserCollection(null, { segment: "all", q: TAG });
    const cards = view.sections.flatMap((s) => s.cards);
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => !c.owned && c.quantity === 0)).toBe(true);
  });

  it("getUserOwnedCountByRarity agrège les quantités par code de rareté", async () => {
    const counts = await getUserOwnedCountByRarity(owner.id);
    expect(counts.get("c")).toBe(4); // 2 + 1 (carte 1) + 1 (carte 2)
  });

  it("getViewerOwnedCardNumbers renvoie les numéros possédés (sans la carte manquante)", async () => {
    const numbers = await getViewerOwnedCardNumbers(owner.id);
    expect(numbers).toContain(catalog.cards[0].number);
    expect(numbers).toContain(catalog.cards[1].number);
    expect(numbers).not.toContain(catalog.cards[2].number);
  });

  // BUG: getUserCompletion compte les lignes CollectionItem (une par couple variante/état,
  // sans filtre quantity > 0) et les rapporte au nombre total de variantes du catalogue.
  // Un membre possédant la même variante en deux états compte double → « owned » (et le %)
  // sont surévalués et peuvent dépasser le total. Attendu : nombre de variantes distinctes.
  // Fichier : src/server/collection/collection.service.ts:313-319.
  it.fails("BUG — getUserCompletion devrait compter des variantes distinctes, pas des lignes par état", async () => {
    const dupUser = await createTestUser(TAG, 7);
    await addToCollection(dupUser.id, catalog.variants[2].id, { condition: "EXCELLENT" });
    await addToCollection(dupUser.id, catalog.variants[2].id, { condition: "MINT" });

    const completion = await getUserCompletion(dupUser.id);
    expect(completion.owned).toBe(1); // observé : 2 (une ligne par état)
  });
});
