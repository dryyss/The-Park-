import "server-only";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";

export type CollectionSegment = "all" | "owned" | "missing";

export interface CollectionFilters {
  segment: CollectionSegment;
  rarity?: string;
  q?: string;
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
  isPromo: boolean;
  numberLabel: string;
  dots: { standard: boolean; reverse: boolean; alternative: boolean };
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

const RARITY_JP: Record<string, string> = {
  c: "一般",
  r: "レア",
  u: "ウルトラ",
  l: "伝説",
  g: "金",
  p: "唯一",
};

const RARITY_TITLE: Record<string, string> = {
  c: "Communes",
  r: "Rares Holo",
  u: "Ultra Rares",
  l: "Légendaires",
  g: "Gold",
  p: "Uniques · Promo",
};

/** Classeur complet d'un utilisateur (possédé / manquant par carte). */
export async function getUserCollection(userId: string, filters: CollectionFilters): Promise<CollectionView> {
  const [cards, items, versionTypes, totalVariants] = await Promise.all([
    prisma.card.findMany({
      orderBy: { number: "asc" },
      include: { rarity: true, variants: { include: { versionType: true } } },
    }),
    prisma.collectionItem.findMany({
      where: { userId },
      include: { variant: { include: { versionType: true, card: true } } },
    }),
    prisma.versionType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.cardVariant.count(),
  ]);

  const vtCodes = new Map(versionTypes.map((v) => [v.id, v.code]));
  const ownedByCard = new Map<number, { qty: number; versions: Set<string> }>();

  for (const item of items) {
    const num = item.variant.card.number;
    const cur = ownedByCard.get(num) ?? { qty: 0, versions: new Set<string>() };
    cur.qty += item.quantity;
    const code = vtCodes.get(item.variant.versionTypeId);
    if (code) cur.versions.add(code);
    ownedByCard.set(num, cur);
  }

  const enriched: CollectionCard[] = cards.map((card) => {
    const meta = rarityMeta(card.rarity.code);
    const own = ownedByCard.get(card.number);
    const owned = !!own && own.qty > 0;
    return {
      number: card.number,
      slug: card.slug,
      name: card.name,
      image: card.imageUrl ? cardImage(card.imageUrl) : null,
      glyph: card.rarity.symbol ?? meta.glyph,
      color: card.rarity.color ?? meta.color,
      tilt: meta.tilt,
      holo: meta.holo,
      owned,
      quantity: own?.qty ?? 0,
      isPromo: card.rarity.code === "p",
      numberLabel: card.rarity.code === "p" ? `${String(card.number).padStart(2, "0")} · PROMO` : `${String(card.number).padStart(2, "0")}/78`,
      dots: {
        standard: own?.versions.has("standard") ?? false,
        reverse: own?.versions.has("reverse") ?? false,
        alternative: own?.versions.has("alternative") ?? false,
      },
    };
  });

  const q = filters.q?.trim().toLowerCase();
  const filtered = enriched.filter((c) => {
    if (filters.segment === "owned" && !c.owned) return false;
    if (filters.segment === "missing" && c.owned) return false;
    if (filters.rarity && cards.find((x) => x.number === c.number)?.rarity.code !== filters.rarity) return false;
    if (q && !c.name.toLowerCase().includes(q) && !String(c.number).includes(q)) return false;
    return true;
  });

  const ownedCards = enriched.filter((c) => c.owned).length;
  const missingCards = enriched.length - ownedCards;

  const rarityOrder = ["c", "r", "u", "l", "g", "p"];
  const byRarityCode = new Map<string, CollectionCard[]>();
  for (const c of filtered) {
    const card = cards.find((x) => x.number === c.number)!;
    const list = byRarityCode.get(card.rarity.code) ?? [];
    list.push(c);
    byRarityCode.set(card.rarity.code, list);
  }

  const sections: RaritySection[] = rarityOrder
    .filter((code) => byRarityCode.has(code))
    .map((code) => {
      const sectionCards = byRarityCode.get(code)!;
      const allInRarity = enriched.filter((c) => cards.find((x) => x.number === c.number)?.rarity.code === code);
      const ownedInRarity = allInRarity.filter((c) => c.owned).length;
      const meta = rarityMeta(code);
      return {
        code,
        title: RARITY_TITLE[code] ?? code,
        jp: RARITY_JP[code] ?? "",
        glyph: meta.glyph,
        color: meta.color,
        owned: ownedInRarity,
        total: allInRarity.length,
        pct: allInRarity.length ? Math.round((ownedInRarity / allInRarity.length) * 100) : 0,
        cards: sectionCards,
      };
    });

  const rarityBars = rarityOrder.map((code) => {
    const allInRarity = enriched.filter((c) => cards.find((x) => x.number === c.number)?.rarity.code === code);
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
