import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { rarityMeta, cardImage, cardNumberLabel, type HoloVariant } from "@/lib/rarity";
import { conditionColor } from "@/lib/condition";
import { formatPrice } from "@/lib/format";
import { VERSION_TYPE_DEFINITIONS } from "@/lib/card-versions";
import { isFirstEditionLabel } from "@/lib/card-edition";
import { RARITY_ORDER } from "@/lib/rarity";
import { ACTIVE_SALE_STATUSES } from "@/server/sale/sale.mutations";
import { listingNotInActiveCart } from "@/server/marketplace-cart/marketplace-cart.service";

/** "sell" = annonces où l'on propose une carte ; "want" = recherches. */
export type MarketIntent = "sell" | "want";

const SELL_TYPES = ["SELL", "SELL_OR_TRADE", "TRADE"] as const;

export interface MarketplaceFilters {
  intent: MarketIntent;
  rarity?: string; // code rareté (c,r,u,l,g,p)
  condition?: string; // CardCondition
  version?: string; // code versionType
  q?: string;
  city?: string; // ville du vendeur
}

export interface MarketplaceCard {
  id: string;
  cardId: string;
  variantId: string;
  seasonId: string;
  seasonLabel: string;
  number: number;
  numberLabel: string;
  name: string;
  slug: string;
  image: string;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  versionLabel: string;
  conditionCode: string;
  conditionColor: string;
  isWant: boolean;
  priceLabel: string;
  purchasable: boolean;
  sellerId: string;
  sellerCity: string | null;
  seller: { name: string; slug: string; initial: string; rating: string; reviews: number };
}

export interface ListingDisplay {
  id: string;
  number: number;
  name: string;
  slug: string;
  image: string;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  price: string;
  type: string;
  sellerName: string;
  sellerSlug: string;
}

const listingInclude = {
  seller: { select: { displayName: true, slug: true } },
  variant: { include: { card: { include: { rarity: true } } } },
} as const;

type ListingRow = {
  id: string;
  price: unknown;
  type: string;
  seller: { displayName: string; slug: string };
  variant: {
    card: {
      number: number;
      name: string;
      slug: string;
      imageUrl: string | null;
      rarity: { code: string; symbol: string | null; color: string | null };
    };
  };
};

function toListingDisplay(l: ListingRow): ListingDisplay {
  const card = l.variant.card;
  const meta = rarityMeta(card.rarity.code);
  return {
    id: l.id,
    number: card.number,
    name: card.name,
    slug: card.slug,
    image: cardImage(card.imageUrl),
    glyph: card.rarity.symbol ?? meta.glyph,
    color: card.rarity.color ?? meta.color,
    tilt: meta.tilt,
    holo: meta.holo,
    variant: meta.variant,
    price: formatPrice(l.price as number),
    type: l.type,
    sellerName: l.seller.displayName,
    sellerSlug: l.seller.slug,
  };
}

/** Dernières annonces actives (marketplace), de la plus récente à la plus ancienne. */
async function fetchRecentListings(limit: number) {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", ...listingNotInActiveCart() },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: listingInclude,
  });
  return listings.map((l) => toListingDisplay(l as unknown as ListingRow));
}

export async function getRecentListings(limit = 6): Promise<ListingDisplay[]> {
  return unstable_cache(() => fetchRecentListings(limit), ["recent-listings", String(limit)], {
    revalidate: 30,
    tags: ["listings"],
  })();
}

function intentWhere(intent: MarketIntent): Prisma.ListingWhereInput {
  return intent === "want" ? { type: "WANT" } : { type: { in: [...SELL_TYPES] } };
}

function buildWhere(f: MarketplaceFilters): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { status: "ACTIVE", ...intentWhere(f.intent) };
  if (f.intent === "sell") {
    where.NOT = { sales: { some: { status: { in: [...ACTIVE_SALE_STATUSES] } } } };
    where.marketplaceCartItems = listingNotInActiveCart().marketplaceCartItems;
  }
  if (f.condition) where.condition = f.condition as Prisma.EnumCardConditionFilter["equals"];
  if (f.rarity) where.variant = { card: { rarity: { code: f.rarity } } };
  if (f.version) {
    where.variant = { ...(where.variant as object), versionType: { code: f.version } };
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { variant: { card: { name: { contains: q, mode: "insensitive" } } } },
      { seller: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (f.city?.trim()) {
    where.seller = { city: { contains: f.city.trim(), mode: "insensitive" } };
  }
  return where;
}

const fullInclude = {
  seller: { select: { id: true, displayName: true, slug: true, ratingAvg: true, reviewCount: true, city: true } },
  variant: {
    include: { versionType: true, card: { include: { rarity: true, season: true } } },
  },
} as const;

type FullRow = Prisma.ListingGetPayload<{ include: typeof fullInclude }>;

function toMarketplaceCard(l: FullRow): MarketplaceCard {
  const card = l.variant.card;
  const meta = rarityMeta(card.rarity.code);
  const isWant = l.type === "WANT";
  const name = l.seller.displayName;
  return {
    id: l.id,
    cardId: card.id,
    variantId: l.variant.id,
    seasonId: card.seasonId,
    seasonLabel: card.season.name,
    number: card.number,
    numberLabel: cardNumberLabel(card.number, card.rarity.code, card.season.code),
    name: card.name,
    slug: card.slug,
    image: cardImage(card.imageUrl),
    glyph: card.rarity.symbol ?? meta.glyph,
    color: card.rarity.color ?? meta.color,
    tilt: meta.tilt,
    holo: meta.holo,
    variant: meta.variant,
    versionLabel: isFirstEditionLabel(l.variant.editionLabel)
      ? "1ère édition"
      : l.variant.editionLabel
        ? "Réédition"
        : l.variant.versionType.label,
    conditionCode: l.condition,
    conditionColor: conditionColor(l.condition),
    isWant,
    priceLabel: isWant ? formatPrice(l.budgetMax) : formatPrice(l.price),
    purchasable: !isWant && (l.type === "SELL" || l.type === "SELL_OR_TRADE") && l.price != null,
    sellerId: l.seller.id,
    sellerCity: l.seller.city ?? null,
    seller: {
      name,
      slug: l.seller.slug,
      initial: name.charAt(0).toUpperCase(),
      rating: l.seller.ratingAvg.toFixed(1).replace(".", ","),
      reviews: l.seller.reviewCount,
    },
  };
}

async function fetchMarketplaceListings(f: MarketplaceFilters): Promise<MarketplaceCard[]> {
  const listings = await prisma.listing.findMany({
    where: buildWhere(f),
    orderBy: { createdAt: "desc" },
    include: fullInclude,
  });
  return listings.map(toMarketplaceCard);
}

/** Annonces filtrées de la marketplace (données globales — mises en cache 60 s, tag `listings`). */
export async function getMarketplaceListings(f: MarketplaceFilters): Promise<MarketplaceCard[]> {
  const key = [
    "marketplace-listings",
    f.intent,
    f.rarity ?? "",
    f.condition ?? "",
    f.version ?? "",
    f.q ?? "",
    f.city ?? "",
  ];
  return unstable_cache(() => fetchMarketplaceListings(f), key, {
    revalidate: 60,
    tags: ["listings"],
  })();
}

export interface MarketplaceFacets {
  sellCount: number;
  wantCount: number;
  rarities: { code: string; count: number }[];
  versions: { code: string; label: string }[];
}

/** Compteurs pour les onglets + chips de filtre (globaux — cache 60 s, tag `listings`). */
export async function getMarketplaceFacets(): Promise<MarketplaceFacets> {
  return unstable_cache(fetchMarketplaceFacets, ["marketplace-facets"], {
    revalidate: 60,
    tags: ["listings"],
  })();
}

async function fetchMarketplaceFacets(): Promise<MarketplaceFacets> {
  const sellWhere = {
    status: "ACTIVE" as const,
    type: { in: [...SELL_TYPES] },
    NOT: { sales: { some: { status: { in: [...ACTIVE_SALE_STATUSES] } } } },
    marketplaceCartItems: listingNotInActiveCart().marketplaceCartItems,
  };
  const [sellCount, wantCount] = await Promise.all([
    prisma.listing.count({ where: sellWhere }),
    prisma.listing.count({ where: { status: "ACTIVE", type: "WANT" } }),
  ]);

  const rarityGroups = await prisma.rarity.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      code: true,
      _count: { select: { cards: true } },
    },
  });

  return {
    sellCount,
    wantCount,
    versions: VERSION_TYPE_DEFINITIONS.map((v) => ({ code: v.code, label: v.label })),
    rarities: RARITY_ORDER.map((code) => ({
      code,
      count: rarityGroups.find((r) => r.code === code)?._count.cards ?? 0,
    })).filter((r) => r.count > 0),
  };
}

// ─── Vue vendeurs par carte ───────────────────────────────────────────────────

export interface CardSeller {
  listingId: string;
  price: number;
  priceLabel: string;
  conditionCode: string;
  conditionColor: string;
  versionLabel: string;
  purchasable: boolean;
  sellerId: string;
  quantity: number;
  allListingIds: string[];
  seller: { name: string; slug: string; initial: string; rating: string; reviews: number };
}

export interface CardWithSellers {
  cardId: string;
  name: string;
  slug: string;
  image: string;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  numberLabel: string;
  rarityLabel: string;
  seasonLabel: string;
  sellers: CardSeller[];
  lowestPriceLabel: string | null;
}

async function fetchCardSellListings(slug: string): Promise<CardWithSellers | null> {
  const card = await prisma.card.findUnique({
    where: { slug },
    include: { rarity: true, season: true },
  });
  if (!card) return null;

  const listings = await prisma.listing.findMany({
    where: {
      variant: { cardId: card.id },
      status: "ACTIVE",
      type: { in: [...SELL_TYPES] },
      NOT: { sales: { some: { status: { in: [...ACTIVE_SALE_STATUSES] } } } },
      marketplaceCartItems: listingNotInActiveCart().marketplaceCartItems,
    },
    orderBy: { price: "asc" },
    include: {
      seller: { select: { id: true, displayName: true, slug: true, ratingAvg: true, reviewCount: true } },
      variant: { include: { versionType: true } },
    },
  });

  const meta = rarityMeta(card.rarity.code);

  const rawSellers: CardSeller[] = listings.map((l) => {
    const name = l.seller.displayName;
    return {
      listingId: l.id,
      price: Number(l.price ?? 0),
      priceLabel: formatPrice(l.price),
      conditionCode: l.condition,
      conditionColor: conditionColor(l.condition),
      versionLabel: isFirstEditionLabel(l.variant.editionLabel)
        ? "1ère édition"
        : l.variant.editionLabel
          ? "Réédition"
          : l.variant.versionType.label,
      purchasable: l.type === "SELL" || l.type === "SELL_OR_TRADE",
      sellerId: l.seller.id,
      quantity: 1,
      allListingIds: [l.id],
      seller: {
        name,
        slug: l.seller.slug,
        initial: name.charAt(0).toUpperCase(),
        rating: l.seller.ratingAvg.toFixed(1).replace(".", ","),
        reviews: l.seller.reviewCount,
      },
    };
  });

  // Grouper par vendeur + état + version (même vendeur, même état, même version = quantité)
  const groupMap = new Map<string, CardSeller>();
  for (const s of rawSellers) {
    const key = `${s.sellerId}:${s.conditionCode}:${s.versionLabel}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.allListingIds.push(s.listingId);
    } else {
      groupMap.set(key, { ...s });
    }
  }
  const sellers: CardSeller[] = Array.from(groupMap.values());

  // Meilleur prix = premier vendeur ayant un prix > 0
  const lowestPriceSeller = sellers.find((s) => s.price > 0);

  return {
    cardId: card.id,
    name: card.name,
    slug: card.slug,
    image: cardImage(card.imageUrl),
    glyph: card.rarity.symbol ?? meta.glyph,
    color: card.rarity.color ?? meta.color,
    tilt: meta.tilt,
    holo: meta.holo,
    variant: meta.variant,
    numberLabel: cardNumberLabel(card.number, card.rarity.code, card.season.code),
    rarityLabel: card.rarity.label,
    seasonLabel: card.season.name,
    sellers,
    lowestPriceLabel: lowestPriceSeller ? lowestPriceSeller.priceLabel : null,
  };
}

export async function getCardSellListings(slug: string): Promise<CardWithSellers | null> {
  return unstable_cache(() => fetchCardSellListings(slug), ["card-sell-listings", slug], {
    revalidate: 30,
    tags: ["listings"],
  })();
}
