import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage, cardNumberLabel, isPromoRarity, type HoloVariant } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";
import { isActiveVersionCode } from "@/lib/card-versions";
import { isFirstEditionLabel, resolveEditionLabel } from "@/lib/card-edition";
import { CONDITION_ORDER } from "@/lib/condition";

// Ordre d'affichage des états (du meilleur au plus abîmé).
const CONDITION_SORT: readonly string[] = CONDITION_ORDER;

/** Représentation d'une carte prête à afficher (vignette holo). */
export interface CardDisplay {
  number: number;
  name: string;
  slug: string;
  image: string;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  isUnique: boolean;
}

function toCardDisplay(card: {
  number: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  isUnique: boolean;
  rarity: { code: string; symbol: string | null; color: string | null };
}): CardDisplay {
  const meta = rarityMeta(card.rarity.code);
  return {
    number: card.number,
    name: card.name,
    slug: card.slug,
    image: cardImage(card.imageUrl),
    glyph: card.rarity.symbol ?? meta.glyph,
    color: card.rarity.color ?? meta.color,
    tilt: meta.tilt,
    holo: meta.holo,
    variant: meta.variant,
    isUnique: card.isUnique,
  };
}

/** Cartes vedettes : les plus cotées de la saison courante. */
async function fetchFeaturedCards(limit: number) {
  const cards = await prisma.card.findMany({
    orderBy: [{ quoteValue: "desc" }, { number: "asc" }],
    take: limit,
    include: { rarity: true },
  });
  return cards.map(toCardDisplay);
}

export async function getFeaturedCards(limit = 5): Promise<CardDisplay[]> {
  return unstable_cache(() => fetchFeaturedCards(limit), ["featured-cards", String(limit)], {
    revalidate: 120,
    tags: ["catalog"],
  })();
}

/** Stats d'en-tête de l'accueil (cartes / raretés / versions / uniques). */
async function fetchCatalogStats() {
  const [totalCards, rarityCount, versionCount, uniqueCount] = await Promise.all([
    prisma.card.count(),
    prisma.rarity.count(),
    prisma.versionType.count(),
    prisma.card.count({ where: { isUnique: true } }),
  ]);
  return { totalCards, rarityCount, versionCount, uniqueCount };
}

export const getCatalogStats = unstable_cache(fetchCatalogStats, ["catalog-stats"], {
  revalidate: 120,
  tags: ["catalog"],
});

/**
 * Couche service catalogue (.cursorrules : pas de Prisma direct dans les composants).
 * Résumé de la saison courante pour l'accueil / les tableaux de complétion.
 */
async function fetchCatalogSummary() {
  const season = await prisma.season.findFirst({
    orderBy: { sortOrder: "asc" },
  });

  if (!season) {
    return { season: null, totalCards: 0, byRarity: [] as const };
  }

  const [totalCards, grouped, rarities] = await Promise.all([
    prisma.card.count({ where: { seasonId: season.id } }),
    prisma.card.groupBy({
      by: ["rarityId"],
      where: { seasonId: season.id },
      _count: { _all: true },
    }),
    prisma.rarity.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const countByRarity = new Map(grouped.map((g) => [g.rarityId, g._count._all]));

  const byRarity = rarities
    .map((r) => ({
      code: r.code,
      label: r.label,
      symbol: r.symbol,
      color: r.color,
      count: countByRarity.get(r.id) ?? 0,
    }))
    .filter((r) => r.count > 0);

  return { season, totalCards, byRarity };
}

export async function getCatalogSummary() {
  return unstable_cache(fetchCatalogSummary, ["catalog-summary"], {
    revalidate: 120,
    tags: ["catalog"],
  })();
}

export interface SeasonCardRow {
  slug: string;
  name: string;
  number: number;
  image: string;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  quantity: number;
  standardVariantId: string;
}

/** Catalogue d'une saison sans données utilisateur — lourd mais global, donc mis en cache. */
async function fetchSeasonCardBase(seasonCode: string): Promise<Omit<SeasonCardRow, "quantity">[]> {
  const season = await prisma.season.findUnique({ where: { code: seasonCode } });
  if (!season) return [];

  const cards = await prisma.card.findMany({
    where: { seasonId: season.id },
    orderBy: { number: "asc" },
    include: { rarity: true, variants: { include: { versionType: true } } },
  });

  return cards.map((c) => {
    const meta = rarityMeta(c.rarity.code);
    const standardVariant = c.variants.find((v) => v.versionType.code === "standard");
    return {
      slug: c.slug,
      name: c.name,
      number: c.number,
      image: cardImage(c.imageUrl),
      glyph: c.rarity.symbol ?? meta.glyph,
      color: c.rarity.color ?? meta.color,
      tilt: meta.tilt,
      holo: meta.holo,
      variant: meta.variant,
      standardVariantId: standardVariant?.id ?? c.variants[0]?.id ?? "",
    };
  });
}

function getSeasonCardBase(seasonCode: string) {
  return unstable_cache(() => fetchSeasonCardBase(seasonCode), ["season-cards-base", seasonCode], {
    revalidate: 300,
    tags: ["catalog"],
  })();
}

export async function getSeasonCards(seasonCode = "S01", viewerUserId?: string): Promise<SeasonCardRow[]> {
  const base = await getSeasonCardBase(seasonCode);
  if (base.length === 0) return [];

  // Sans viewer (navigation publique) : catalogue caché, aucune requête par-utilisateur.
  if (!viewerUserId) return base.map((c) => ({ ...c, quantity: 0 }));

  // Quantités possédées : seule requête live (légère), fusionnée sur le catalogue caché.
  const items = await prisma.collectionItem.findMany({
    where: { userId: viewerUserId, variant: { card: { season: { code: seasonCode } } } },
    select: { quantity: true, variant: { select: { card: { select: { number: true } } } } },
  });

  const qtyByNumber = new Map<number, number>();
  for (const item of items) {
    const num = item.variant.card.number;
    qtyByNumber.set(num, (qtyByNumber.get(num) ?? 0) + item.quantity);
  }

  return base.map((c) => ({ ...c, quantity: qtyByNumber.get(c.number) ?? 0 }));
}

export interface CardDetail {
  id: string;
  slug: string;
  number: number;
  numberLabel: string;
  name: string;
  image: string;
  description: string | null;
  glyph: string;
  color: string;
  rarityLabel: string;
  rarityCode: string;
  country: string | null;
  quoteLabel: string;
  powerCh: number | null;
  weightKg: number | null;
  isPromo: boolean;
  isUnique: boolean;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  prevSlug: string | null;
  nextSlug: string | null;
  versions: {
    variantId: string;
    code: string;
    label: string;
    image: string;
    owned: boolean;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    catalogEditionLabel: string | null;
    userEditionLabel: string | null;
    editionLabel: string | null;
    isFirstEdition: boolean;
    // Détail par état possédé + annonce active du viewer pour cet état (le cas échéant).
    conditions: {
      condition: string;
      quantity: number;
      reservedQuantity: number;
      available: number;
      listing: { id: string; type: string; price: string | null } | null;
      isGraded: boolean;
    }[];
  }[];
  listings: {
    id: string;
    sellerId: string;
    price: string;
    sellerName: string;
    sellerSlug: string;
    sellerInitial: string;
    rating: string;
    versionLabel: string;
    conditionCode: string;
  }[];
}

/** Fiche carte complète + annonces actives liées. */
export async function getCardDetail(slug: string, viewerUserId?: string): Promise<CardDetail | null> {
  const card = await prisma.card.findUnique({
    where: { slug },
    include: {
      rarity: true,
      variants: { include: { versionType: true } },
    },
  });
  if (!card) return null;

  const [neighbors, listings, ownedVariants, viewerListings] = await Promise.all([
    prisma.card.findMany({
      where: { seasonId: card.seasonId },
      orderBy: { number: "asc" },
      select: { number: true, slug: true },
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE", variant: { cardId: card.id } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        seller: { select: { displayName: true, slug: true, ratingAvg: true } },
        variant: { include: { versionType: true } },
      },
    }),
    viewerUserId
      ? prisma.collectionItem.findMany({
          where: { userId: viewerUserId, variant: { cardId: card.id } },
          select: { variantId: true, condition: true, quantity: true, reservedQuantity: true, editionLabel: true, isGraded: true },
        })
      : Promise.resolve([]),
    viewerUserId
      ? prisma.listing.findMany({
          where: { sellerId: viewerUserId, status: "ACTIVE", variant: { cardId: card.id } },
          select: { id: true, variantId: true, condition: true, type: true, price: true },
        })
      : Promise.resolve([]),
  ]);

  // Annonce active du viewer par (variante, état) — pour signaler ce qui est déjà listé.
  const viewerListingByKey = new Map<string, { id: string; type: string; price: string | null }>();
  for (const l of viewerListings) {
    const key = `${l.variantId}:${l.condition}`;
    if (!viewerListingByKey.has(key)) {
      viewerListingByKey.set(key, { id: l.id, type: l.type, price: l.price != null ? formatPrice(l.price) : null });
    }
  }

  // Détail des états possédés par variante.
  const conditionsByVariant = new Map<
    string,
    { condition: string; quantity: number; reservedQuantity: number; isGraded: boolean }[]
  >();
  for (const o of ownedVariants) {
    if (o.quantity <= 0) continue;
    const list = conditionsByVariant.get(o.variantId) ?? [];
    list.push({
      condition: o.condition,
      quantity: o.quantity,
      reservedQuantity: o.reservedQuantity,
      isGraded: o.isGraded,
    });
    conditionsByVariant.set(o.variantId, list);
  }

  const idx = neighbors.findIndex((n) => n.slug === slug);
  const meta = rarityMeta(card.rarity.code);
  const variantStats = new Map<
    string,
    { quantity: number; reservedQuantity: number; userEditionLabel: string | null }
  >();
  for (const o of ownedVariants) {
    const cur = variantStats.get(o.variantId) ?? {
      quantity: 0,
      reservedQuantity: 0,
      userEditionLabel: null,
    };
    cur.quantity += o.quantity;
    cur.reservedQuantity += o.reservedQuantity;
    if (o.editionLabel?.trim()) cur.userEditionLabel = o.editionLabel.trim();
    variantStats.set(o.variantId, cur);
  }

  return {
    id: card.id,
    slug: card.slug,
    number: card.number,
    numberLabel: cardNumberLabel(card.number, card.rarity.code),
    name: card.name,
    image: cardImage(card.imageUrl),
    description: card.description,
    glyph: card.rarity.symbol ?? meta.glyph,
    color: card.rarity.color ?? meta.color,
    rarityLabel: card.rarity.label,
    rarityCode: card.rarity.code,
    country: card.country,
    quoteLabel: formatPrice(card.quoteValue),
    powerCh: card.powerCh,
    weightKg: card.weightKg,
    isPromo: isPromoRarity(card.rarity.code),
    isUnique: card.isUnique,
    tilt: meta.tilt,
    holo: meta.holo,
    variant: meta.variant,
    prevSlug: idx > 0 ? neighbors[idx - 1].slug : null,
    nextSlug: idx < neighbors.length - 1 ? neighbors[idx + 1].slug : null,
    versions: card.variants
      .filter((v) => isActiveVersionCode(v.versionType.code))
      .map((v) => {
      const stats = variantStats.get(v.id);
      const quantity = stats?.quantity ?? 0;
      const reservedQuantity = stats?.reservedQuantity ?? 0;
      const catalogEditionLabel = v.editionLabel?.trim() || null;
      const userEditionLabel = stats?.userEditionLabel ?? null;
      const editionLabel = resolveEditionLabel(userEditionLabel, catalogEditionLabel);
      const conditions = (conditionsByVariant.get(v.id) ?? [])
        .slice()
        .sort((a, b) => CONDITION_SORT.indexOf(a.condition) - CONDITION_SORT.indexOf(b.condition))
        .map((c) => ({
          condition: c.condition,
          quantity: c.quantity,
          reservedQuantity: c.reservedQuantity,
          available: c.quantity - c.reservedQuantity,
          listing: viewerListingByKey.get(`${v.id}:${c.condition}`) ?? null,
          isGraded: c.isGraded,
        }));
      return {
        variantId: v.id,
        code: v.versionType.code,
        label: v.versionType.label,
        image: cardImage(v.imageUrl ?? card.imageUrl),
        owned: quantity > 0,
        quantity,
        reservedQuantity,
        availableQuantity: quantity - reservedQuantity,
        catalogEditionLabel,
        userEditionLabel,
        editionLabel,
        isFirstEdition: isFirstEditionLabel(editionLabel),
        conditions,
      };
    }),
    listings: listings.map((l) => ({
      id: l.id,
      sellerId: l.sellerId,
      price: formatPrice(l.price ?? l.budgetMax),
      sellerName: l.seller.displayName,
      sellerSlug: l.seller.slug,
      sellerInitial: l.seller.displayName.charAt(0).toUpperCase(),
      rating: l.seller.ratingAvg.toFixed(1).replace(".", ","),
      versionLabel: l.variant.versionType.label,
      conditionCode: l.condition,
    })),
  };
}

export interface SearchHit {
  slug: string;
  number: number;
  name: string;
  image: string;
  glyph: string;
  color: string;
  rarityLabel: string;
}

export type SearchSort = "number" | "name" | "rarity";

export interface SearchFilters {
  q?: string;
  rarity?: string; // code rareté (c,r,u,l,g,p)
  version?: string; // code versionType
  sort?: SearchSort;
  limit?: number;
}

/** Facettes pour les filtres de recherche (raretés + versions du catalogue). */
export interface CatalogFacets {
  rarities: { code: string; label: string; count: number }[];
  versions: { code: string; label: string }[];
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  return unstable_cache(fetchCatalogFacets, ["catalog-facets"], {
    revalidate: 120,
    tags: ["catalog"],
  })();
}

async function fetchCatalogFacets(): Promise<CatalogFacets> {
  const [rarities, versions] = await Promise.all([
    prisma.rarity.findMany({
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true, _count: { select: { cards: true } } },
    }),
    prisma.versionType.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, label: true } }),
  ]);

  return {
    rarities: rarities
      .map((r) => ({ code: r.code, label: r.label, count: r._count.cards }))
      .filter((r) => r.count > 0),
    versions: versions.filter((v) => isActiveVersionCode(v.code)),
  };
}

function searchOrderBy(sort: SearchSort | undefined): Prisma.CardOrderByWithRelationInput {
  switch (sort) {
    case "name":
      return { name: "asc" };
    case "rarity":
      return { rarity: { sortOrder: "asc" } };
    default:
      return { number: "asc" };
  }
}

/** Recherche globale catalogue (texte + facettes raretés/versions + tri). */
export async function searchCards(filters: SearchFilters = {}): Promise<SearchHit[]> {
  const term = (filters.q ?? "").trim();
  const limit = filters.limit ?? 24;
  const hasFacet = !!(filters.rarity || filters.version);

  // Sans terme ni filtre, on ne renvoie rien (état d'accueil géré côté page).
  if (!term && !hasFacet) return [];

  const and: Prisma.CardWhereInput[] = [];
  if (term) {
    const num = parseInt(term, 10);
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        ...(Number.isFinite(num) ? [{ number: num }] : []),
      ],
    });
  }
  if (filters.rarity) and.push({ rarity: { code: filters.rarity } });
  if (filters.version) and.push({ variants: { some: { versionType: { code: filters.version } } } });

  const cards = await prisma.card.findMany({
    where: and.length ? { AND: and } : {},
    take: limit,
    orderBy: searchOrderBy(filters.sort),
    include: { rarity: true },
  });

  return cards.map((c) => {
    const meta = rarityMeta(c.rarity.code);
    return {
      slug: c.slug,
      number: c.number,
      name: c.name,
      image: cardImage(c.imageUrl),
      glyph: c.rarity.symbol ?? meta.glyph,
      color: c.rarity.color ?? meta.color,
      rarityLabel: c.rarity.label,
    };
  });
}
