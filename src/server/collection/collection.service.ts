import "server-only";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage, cardNumberLabel, isPromoRarity, RARITY_ORDER, rarityTitle, rarityJp } from "@/lib/rarity";
import { isExcludedFromCompletion } from "@/lib/rarities";
import { isActiveVersionCode } from "@/lib/card-versions";
import { isFirstEditionLabel, resolveEditionLabel } from "@/lib/card-edition";
import { sortCollectionCards, type CollectionSort } from "@/lib/collection-sort";

export type CollectionSegment = "all" | "owned" | "missing";

export interface CollectionFilters {
  segment: CollectionSegment;
  rarity?: string;
  q?: string;
  sort?: CollectionSort;
  /** Code de saison (ex: "S01", "HS"). Null = toutes saisons. */
  season?: string;
  /** Filtre par Ã©dition : "first" = 1Ã¨re Ã©dition, "reprint" = rÃ©Ã©dition. */
  edition?: "first" | "reprint";
}

export interface CollectionCard {
  cardId: string;
  seasonId: string;
  seasonLabel: string;
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
  hasReprint: boolean;
  numberLabel: string;
  dots: { code: string; owned: boolean }[];
}

export interface EditionStats {
  firstTotal: number;
  firstOwned: number;
  firstPct: number;
  reprintTotal: number;
  reprintOwned: number;
  reprintPct: number;
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

export interface SeasonCompletion {
  code: string;
  name: string;
  total: number;
  owned: number;
  pct: number;
}

export interface CollectionView {
  overallPct: number;
  overallOwned: number;
  totalVariants: number;
  rarityBars: { code: string; label: string; glyph: string; color: string; owned: number; total: number; pct: number }[];
  sections: RaritySection[];
  counts: { all: number; owned: number; missing: number };
  editionStats?: EditionStats;
  seasonPcts: SeasonCompletion[];
}

/** Classeur complet (possÃ©dÃ© / manquant par carte). userId null = visiteur (tout en manquant). */
export async function getUserCollection(userId: string | null, filters: CollectionFilters): Promise<CollectionView> {
  const [cards, items, versionTypes, totalVariants] = await Promise.all([
    prisma.card.findMany({
      orderBy: { number: "asc" },
      include: { rarity: true, season: true, variants: { include: { versionType: true } } },
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
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const ownedByCard = new Map<
    string,
    { qty: number; firstQty: number; reprintQty: number; versions: Set<string>; hasFirstEdition: boolean; hasReprint: boolean }
  >();

  for (const item of items) {
    const cardId = item.variant.cardId;
    const cur = ownedByCard.get(cardId) ?? { qty: 0, firstQty: 0, reprintQty: 0, versions: new Set<string>(), hasFirstEdition: false, hasReprint: false };
    cur.qty += item.quantity;
    const code = vtCodes.get(item.variant.versionTypeId);
    if (code) cur.versions.add(code);
    const effective = resolveEditionLabel(item.editionLabel, item.variant.editionLabel);
    if (isFirstEditionLabel(effective)) {
      cur.hasFirstEdition = true;
      cur.firstQty += item.quantity;
    } else {
      // Toute possession qui n'est pas une « 1ère édition » (libellé vide inclus) est une réédition.
      cur.hasReprint = true;
      cur.reprintQty += item.quantity;
    }
    ownedByCard.set(cardId, cur);
  }

  const enriched: CollectionCard[] = cards.map((card) => {
    const meta = rarityMeta(card.rarity.code);
    const own = ownedByCard.get(card.id);
    // Quantité/possession affichées selon le filtre d'édition actif (sinon total toutes éditions).
    const editionQty =
      filters.edition === "first"
        ? (own?.firstQty ?? 0)
        : filters.edition === "reprint"
          ? (own?.reprintQty ?? 0)
          : (own?.qty ?? 0);
    const owned = editionQty > 0;
    const standardVariant = card.variants.find((v) => v.versionType.code === "standard");
    const imageFile =
      card.imageUrl ??
      card.variants.find((v) => v.imageUrl)?.imageUrl ??
      null;
    return {
      cardId: card.id,
      seasonId: card.seasonId,
      seasonLabel: card.season.name,
      number: card.number,
      slug: card.slug,
      name: card.name,
      image: imageFile ? cardImage(imageFile) : null,
      glyph: card.rarity.symbol ?? meta.glyph,
      color: card.rarity.color ?? meta.color,
      tilt: meta.tilt,
      holo: meta.holo,
      owned,
      quantity: editionQty,
      standardVariantId: standardVariant?.id ?? card.variants[0]?.id ?? "",
      isPromo: isPromoRarity(card.rarity.code),
      hasFirstEdition: own?.hasFirstEdition ?? false,
      hasReprint: own?.hasReprint ?? false,
      numberLabel: cardNumberLabel(card.number, card.rarity.code, card.season.code, {
        seriesCode: card.season.seriesCode,
        edition: filters.edition ?? null,
      }),
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
    const card = cardById.get(c.cardId);
    if (!card) return false;
    if (filters.segment === "owned" && !c.owned) return false;
    if (filters.segment === "missing" && c.owned) return false;
    if (filters.rarity && card.rarity.code !== filters.rarity) return false;
    if (filters.season && card.season.code !== filters.season) return false;
    if (filters.edition === "first" && !card.variants.some((v) => isFirstEditionLabel(v.editionLabel))) return false;
    if (filters.edition === "reprint" && !card.variants.some((v) => !isFirstEditionLabel(v.editionLabel))) return false;
    if (q) {
      const nameMatch = c.name.toLowerCase().includes(q);
      const numPadded = String(c.number).padStart(2, "0");
      const numMatch = numPadded.includes(q);
      const promoMatch = q.includes("promo") && isPromoRarity(card.rarity.code);
      const hsMatch = q.includes("hs") && card.season.code === "HS";
      // Recherche par code série : "mf" (toute la série), "mf1"/"mf2" (édition),
      // "mf-03" / "mf2-03" (édition + numéro).
      let seriesMatch = false;
      const series = card.season.seriesCode?.toLowerCase();
      if (series) {
        const tokens = [series, `${series}-${numPadded}`];
        if (card.variants.some((v) => isFirstEditionLabel(v.editionLabel)))
          tokens.push(`${series}1`, `${series}1-${numPadded}`);
        if (card.variants.some((v) => !isFirstEditionLabel(v.editionLabel)))
          tokens.push(`${series}2`, `${series}2-${numPadded}`);
        seriesMatch = tokens.some((tok) => tok.includes(q));
      }
      if (!nameMatch && !numMatch && !promoMatch && !hsMatch && !seriesMatch) return false;
    }
    return true;
  });

  // Base de calcul : filtrÃ©e par saison si une saison est active, sinon tout le catalogue.
  // Exclut "unique" et "signed" du taux de complÃ©tion (trop rares pour atteindre 100%).
  const contextBase = enriched.filter((c) => {
    const card = cardById.get(c.cardId);
    if (!card || isExcludedFromCompletion(card.rarity.code)) return false;
    if (filters.season && card.season.code !== filters.season) return false;
    if (filters.edition === "first" && !card.variants.some((v) => isFirstEditionLabel(v.editionLabel))) return false;
    if (filters.edition === "reprint" && !card.variants.some((v) => !isFirstEditionLabel(v.editionLabel))) return false;
    return true;
  });
  const ownedCards = contextBase.filter((c) => c.owned).length;
  const missingCards = contextBase.length - ownedCards;

  const rarityOrder = RARITY_ORDER;
  const byRarityCode = new Map<string, CollectionCard[]>();
  for (const c of filtered) {
    const card = cardById.get(c.cardId)!;
    const list = byRarityCode.get(card.rarity.code) ?? [];
    list.push(c);
    byRarityCode.set(card.rarity.code, list);
  }

  const sections: RaritySection[] = rarityOrder
    .filter((code) => byRarityCode.has(code))
    .map((code) => {
      const sectionCards = byRarityCode.get(code)!;
      const allInRarity = contextBase.filter((c) => cardById.get(c.cardId)?.rarity.code === code);
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
    const allInRarity = contextBase.filter((c) => cardById.get(c.cardId)?.rarity.code === code);
    const ownedInRarity = allInRarity.filter((c) => c.owned).length;
    const meta = rarityMeta(code);
    const r = cards.find((x) => x.rarity.code === code)?.rarity;
    return {
      code,
      label: meta.label ?? r?.label,
      glyph: r?.symbol ?? meta.glyph,
      color: r?.color ?? meta.color,
      owned: ownedInRarity,
      total: allInRarity.length,
      pct: allInRarity.length ? Math.round((ownedInRarity / allInRarity.length) * 100) : 0,
    };
  });

  const overallPct = contextBase.length > 0 ? Math.round((ownedCards / contextBase.length) * 100) : 0;

  let editionStats: EditionStats | undefined = undefined;
  if (filters.season) {
    let firstTotal = 0, firstOwned = 0, reprintTotal = 0, reprintOwned = 0;
    for (const c of enriched) {
      const card = cardById.get(c.cardId);
      if (!card || card.season.code !== filters.season || isExcludedFromCompletion(card.rarity.code)) continue;
      if (card.variants.some((v) => isFirstEditionLabel(v.editionLabel))) {
        firstTotal++;
        if (c.hasFirstEdition) firstOwned++;
      }
      if (card.variants.some((v) => !isFirstEditionLabel(v.editionLabel))) {
        reprintTotal++;
        if (c.hasReprint) reprintOwned++;
      }
    }
    editionStats = {
      firstTotal,
      firstOwned,
      firstPct: firstTotal > 0 ? Math.round((firstOwned / firstTotal) * 100) : 0,
      reprintTotal,
      reprintOwned,
      reprintPct: reprintTotal > 0 ? Math.round((reprintOwned / reprintTotal) * 100) : 0,
    };
  }

  // Taux de complÃ©tion globaux par saison (calculÃ©s toujours sur l'ensemble du catalogue).
  const seasonCodeSet = new Set(enriched.map((c) => cardById.get(c.cardId)?.season.code).filter(Boolean) as string[]);
  const seasonPcts: SeasonCompletion[] = Array.from(seasonCodeSet).map((code) => {
    const sc = enriched.filter((c) => {
      const card = cardById.get(c.cardId);
      return card && card.season.code === code && !isExcludedFromCompletion(card.rarity.code);
    });
    const owned = sc.filter((c) => c.owned).length;
    const seasonName = enriched.map((c) => cardById.get(c.cardId)).find((card) => card?.season.code === code)?.season.name ?? code;
    return { code, name: seasonName, total: sc.length, owned, pct: sc.length > 0 ? Math.round((owned / sc.length) * 100) : 0 };
  });

  return {
    overallPct,
    overallOwned: ownedCards,
    totalVariants,
    rarityBars,
    sections,
    counts: { all: contextBase.length, owned: ownedCards, missing: missingCards },
    editionStats,
    seasonPcts,
  };
}

/** QuantitÃ©s possÃ©dÃ©es par code de raretÃ©, toutes saisons confondues (y compris hors sÃ©rie). */
export async function getUserOwnedCountByRarity(userId: string): Promise<Map<string, number>> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: {
      quantity: true,
      variant: { select: { card: { select: { rarity: { select: { code: true } } } } } },
    },
  });

  const counts = new Map<string, number>();
  for (const item of items) {
    const code = item.variant.card.rarity.code;
    counts.set(code, (counts.get(code) ?? 0) + item.quantity);
  }
  return counts;
}

/** NumÃ©ros de cartes possÃ©dÃ©es par le membre (au moins 1 exemplaire). */
export async function getViewerOwnedCardNumbers(userId: string): Promise<number[]> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: { variant: { select: { card: { select: { number: true } } } } },
  });
  return [...new Set(items.map((item) => item.variant.card.number))];
}

/** ComplÃ©tion d'un membre (profil public). */
export async function getUserCompletion(userId: string) {
  const [owned, total] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.cardVariant.count(),
  ]);
  return { owned, total, pct: total > 0 ? Math.round((owned / total) * 100) : 0 };
}
