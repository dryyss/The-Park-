import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage, type HoloVariant } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";

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
  image: string;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
}

/** Grille catalogue d'une saison (tri par numéro). */
export async function getSeasonCards(seasonCode = "S01"): Promise<SeasonCardRow[]> {
  const season = await prisma.season.findUnique({ where: { code: seasonCode } });
  if (!season) return [];

  const cards = await prisma.card.findMany({
    where: { seasonId: season.id },
    orderBy: { number: "asc" },
    include: { rarity: true },
  });

  return cards.map((c) => {
    const meta = rarityMeta(c.rarity.code);
    return {
      slug: c.slug,
      name: c.name,
      image: cardImage(c.imageUrl),
      glyph: c.rarity.symbol ?? meta.glyph,
      color: c.rarity.color ?? meta.color,
      tilt: meta.tilt,
      holo: meta.holo,
      variant: meta.variant,
    };
  });
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
  versions: { variantId: string; code: string; label: string; owned: boolean }[];
  listings: {
    id: string;
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

  const [neighbors, listings, ownedVariants] = await Promise.all([
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
          select: { variantId: true },
        })
      : Promise.resolve([]),
  ]);

  const idx = neighbors.findIndex((n) => n.slug === slug);
  const meta = rarityMeta(card.rarity.code);
  const ownedSet = new Set(ownedVariants.map((o) => o.variantId));

  return {
    id: card.id,
    slug: card.slug,
    number: card.number,
    numberLabel: card.rarity.code === "p" ? `${String(card.number).padStart(2, "0")} · PROMO` : `${String(card.number).padStart(2, "0")}/78`,
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
    isPromo: card.rarity.code === "p",
    isUnique: card.isUnique,
    tilt: meta.tilt,
    holo: meta.holo,
    variant: meta.variant,
    prevSlug: idx > 0 ? neighbors[idx - 1].slug : null,
    nextSlug: idx < neighbors.length - 1 ? neighbors[idx + 1].slug : null,
    versions: card.variants.map((v) => ({
      variantId: v.id,
      code: v.versionType.code,
      label: v.versionType.label,
      owned: ownedSet.has(v.id),
    })),
    listings: listings.map((l) => ({
      id: l.id,
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

/** Recherche globale catalogue. */
export async function searchCards(q: string, limit = 24): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];

  const num = parseInt(term, 10);
  const cards = await prisma.card.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        ...(Number.isFinite(num) ? [{ number: num }] : []),
      ],
    },
    take: limit,
    orderBy: { number: "asc" },
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
