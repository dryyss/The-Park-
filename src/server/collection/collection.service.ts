import "server-only";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage, cardNumberLabel, isPromoRarity, RARITY_ORDER, rarityTitle, rarityJp } from "@/lib/rarity";
import { isActiveVersionCode } from "@/lib/card-versions";
import { isFirstEditionLabel, resolveEditionLabel } from "@/lib/card-edition";
import { sortCollectionCards, type CollectionSort } from "@/lib/collection-sort";

export type CollectionSegment = "all" | "owned" | "missing";

export interface CollectionFilters {
  segment: CollectionSegment;
  rarity?: string;
  q?: string;
  sort?: CollectionSort;
}

export interface CollectionCard {
  number: number;
  slug: string;
  name: string;
  image: string | null;
  glyph: string;
  color: string;
  tilt: number;
  holo: number;
  owned: boolean;
  quantity: number;
  standardVariantId: string;
  isPromo: boolean;
  hasFirstEdition: boolean;
  numberLabel: string;
  dots: { code: string; owned: boolean }[];
}

export interface RaritySection {
  code: string;
  title: string;
  jp: string;
  glyph: string;
  color: string;
  owned: number;
  total: number;
  pct: number;
  cards: CollectionCard[];
}

export interface CollectionView {
  overallPct: number;
  overallOwned: number;
  totalVariants: number;
  rarityBars: { code: string; label: string; glyph: string; color: string; owned: number; total: number; pct: number }[];
  sections: RaritySection[];
  counts: { all: number; owned: number; missing: number };
}

/** Classeur complet (possédé / manquant par carte). userId null = visiteur (tout en manquant). */
export async function getUserCollection(userId: string | null, filters: CollectionFilters): Promise<CollectionView> {
  const [cards, items, versionTypes, totalVariants] = await Promise.all([
    prisma.card.findMany({
      orderBy: { number: "asc" },
      include: { rarity: true, variants: { include: { versionType: true } } },
    }),
    userId
      ? prisma.collectionItem.findMany({
          where: { userId },
          include: { variant: { include: { versionType: true, card: true } } },
        })
      : Promise.resolve([]),
    prisma.versionType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.cardVariant.count(),
  ]);

  const vtCodes = new Map(versionTypes.map((v) => [v.id, v.code]));
  const cardByNumber = new Map(cards.map((c) => [c.number, c]));
  const ownedByCard = new Map<
    number,
    { qty: number; versions: Set<string>; hasFirstEdition: boolean }
  >();

  for (const item of items) {
    const num = item.variant.card.number;
    const cur = ownedByCard.get(num) ?? { qty: 0, versions: new Set<string>(), hasFirstEdition: false };
    cur.qty += item.quantity;
    const code = vtCodes.get(item.variant.versionTypeId);
    if (code) cur.versions.add(code);
    const effective = resolveEditionLabel(item.editionLabel, item.variant.editionLabel);
    if (isFirstEditionLabel(effective)) cur.hasFirstEdition = true;
    ownedByCard.set(num, cur);
  }

  const enriched: CollectionCard[] = cards.map((card) => {
    const meta = rarityMeta(card.rarity.code);
    const own = ownedByCard.get(card.number);
    const owned = !!own && own.qty > 0;
    const standardVariant = card.variants.find((v) => v.versionType.code === "standard");
    const imageFile =
      card.imageUrl ??
      card.variants.find((v) => v.imageUrl)?.imageUrl ??
      null;
    return {
      number: card.number,
      slug: card.slug,
      name: card.name,
      image: imageFile ? cardImage(imageFile) : null,
      glyph: card.rarity.symbol ?? meta.glyph,
      color: card.rarity.color ?? meta.color,
      tilt: meta.tilt,
      holo: meta.holo,
      owned,
      quantity: own?.qty ?? 0,
      standardVariantId: standardVariant?.id ?? card.variants[0]?.id ?? "",
      isPromo: isPromoRarity(card.rarity.code),
      hasFirstEdition: own?.hasFirstEdition ?? false,
      numberLabel: cardNumberLabel(card.number, card.rarity.code),
      dots: card.variants
        .filter((v) => isActiveVersionCode(v.versionType.code))
        .map((v) => ({
        code: v.versionType.code,
        owned: own?.versions.has(v.versionType.code) ?? false,
      })),
    };
  });

  const q = filters.q?.trim().toLowerCase();
  const filtered = enriched.filter((c) => {
    if (filters.segment === "owned" && !c.owned) return false;
    if (filters.segment === "missing" && c.owned) return false;
    if (filters.rarity && cardByNumber.get(c.number)?.rarity.code !== filters.rarity) return false;
    if (q) {
      const nameMatch = c.name.toLowerCase().includes(q);
      const numPadded = String(c.number).padStart(2, "0");
      const numMatch = numPadded.includes(q);
      const promoMatch = q.includes("promo") && isPromoRarity(cardByNumber.get(c.number)?.rarity.code ?? "");
      if (!nameMatch && !numMatch && !promoMatch) return false;
    }
    return true;
  });

  const ownedCards = enriched.filter((c) => c.owned).length;
  const missingCards = enriched.length - ownedCards;

  const rarityOrder = RARITY_ORDER;
  const byRarityCode = new Map<string, CollectionCard[]>();
  for (const c of filtered) {
    const card = cardByNumber.get(c.number)!;
    const list = byRarityCode.get(card.rarity.code) ?? [];
    list.push(c);
    byRarityCode.set(card.rarity.code, list);
  }

  const sections: RaritySection[] = rarityOrder
    .filter((code) => byRarityCode.has(code))
    .map((code) => {
      const sectionCards = byRarityCode.get(code)!;
      const allInRarity = enriched.filter((c) => cardByNumber.get(c.number)?.rarity.code === code);
      const ownedInRarity = allInRarity.filter((c) => c.owned).length;
      const meta = rarityMeta(code);
      return {
        code,
        title: rarityTitle(code),
        jp: rarityJp(code),
        glyph: meta.glyph,
        color: meta.color,
        owned: ownedInRarity,
        total: allInRarity.length,
        pct: allInRarity.length ? Math.round((ownedInRarity / allInRarity.length) * 100) : 0,
        cards: sortCollectionCards(sectionCards, filters.sort ?? "number"),
      };
    });

  const rarityBars = rarityOrder.map((code) => {
    const allInRarity = enriched.filter((c) => cardByNumber.get(c.number)?.rarity.code === code);
    const ownedInRarity = allInRarity.filter((c) => c.owned).length;
    const meta = rarityMeta(code);
    const r = cards.find((x) => x.rarity.code === code)?.rarity;
    return {
      code,
      label: r?.label ?? meta.label,
      glyph: r?.symbol ?? meta.glyph,
      color: r?.color ?? meta.color,
      owned: ownedInRarity,
      total: allInRarity.length,
      pct: allInRarity.length ? Math.round((ownedInRarity / allInRarity.length) * 100) : 0,
    };
  });

  const ownedVariants = items.reduce((s, i) => s + i.quantity, 0);
  const overallPct = totalVariants > 0 ? Math.round((ownedVariants / totalVariants) * 100) : 0;

  return {
    overallPct,
    overallOwned: ownedVariants,
    totalVariants,
    rarityBars,
    sections,
    counts: { all: enriched.length, owned: ownedCards, missing: missingCards },
  };
}

/** Complétion d'un membre (profil public). */
export async function getUserCompletion(userId: string) {
  const [owned, total] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.cardVariant.count(),
  ]);
  return { owned, total, pct: total > 0 ? Math.round((owned / total) * 100) : 0 };
}
