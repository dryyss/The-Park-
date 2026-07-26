import "server-only";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage, cardNumberLabel, isPromoRarity, RARITY_ORDER, rarityTitle, rarityJp } from "@/lib/rarity";
import { isExcludedFromCompletion } from "@/lib/rarities";
import { isActiveVersionCode } from "@/lib/card-versions";
import { sortCollectionCards, type CollectionSort } from "@/lib/collection-sort";

export type CollectionSegment = "all" | "owned" | "missing";

export interface CollectionFilters {
  segment: CollectionSegment;
  rarity?: string;
  q?: string;
  sort?: CollectionSort;
  /** Code de saison (ex: "S01", "HS"). Null = toutes saisons. */
  season?: string;
  /** Code de collection (ex: "CHROME26"). Null = toutes collections. */
  set?: string;
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

export interface SeasonCompletion {
  code: string;
  name: string;
  total: number;
  owned: number;
  pct: number;
}

/** Complétion d'une collection : mêmes champs qu'une saison, plus son identifiant. */
export interface SetCompletion extends SeasonCompletion {
  id: string;
}

export interface CollectionView {
  overallPct: number;
  overallOwned: number;
  totalVariants: number;
  rarityBars: { code: string; label: string; glyph: string; color: string; owned: number; total: number; pct: number }[];
  sections: RaritySection[];
  counts: { all: number; owned: number; missing: number };
  seasonPcts: SeasonCompletion[];
  setPcts: SetCompletion[];
}

/**
 * Taux de complétion par saison, sans monter tout le classeur.
 *
 * Sert à la barre d'onglets, rendue dans le layout du segment : elle reste ainsi
 * montée (et cliquable) pendant que la page se recharge. Deux requêtes légères,
 * là où `getUserCollection` charge tout le catalogue avec ses variantes.
 */
export async function getSeasonCompletion(userId: string | null): Promise<SeasonCompletion[]> {
  const [cards, items] = await Promise.all([
    prisma.card.findMany({
      select: {
        id: true,
        rarity: { select: { code: true } },
        season: { select: { code: true, name: true, sortOrder: true } },
      },
    }),
    userId
      ? prisma.collectionItem.findMany({
          where: { userId, quantity: { gt: 0 } },
          select: { variant: { select: { cardId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const ownedCardIds = new Set(items.map((i) => i.variant.cardId));
  const bySeason = new Map<string, { name: string; sortOrder: number; total: number; owned: number }>();

  for (const card of cards) {
    if (isExcludedFromCompletion(card.rarity.code)) continue;
    const entry = bySeason.get(card.season.code) ?? {
      name: card.season.name,
      sortOrder: card.season.sortOrder,
      total: 0,
      owned: 0,
    };
    entry.total += 1;
    if (ownedCardIds.has(card.id)) entry.owned += 1;
    bySeason.set(card.season.code, entry);
  }

  return Array.from(bySeason.entries())
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([code, e]) => ({
      code,
      name: e.name,
      total: e.total,
      owned: e.owned,
      pct: e.total > 0 ? Math.round((e.owned / e.total) * 100) : 0,
    }));
}

/**
 * Taux de complétion par collection, pour la barre d'onglets.
 *
 * Une collection est transverse aux saisons : son total se compte sur les cartes
 * qui y ont une déclinaison, pas sur celles de la saison affichée.
 */
export async function getSetCompletion(userId: string | null): Promise<SetCompletion[]> {
  const [sets, variants, items] = await Promise.all([
    prisma.cardSet.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.cardVariant.findMany({
      where: { setId: { not: null } },
      select: { setId: true, cardId: true, card: { select: { rarity: { select: { code: true } } } } },
    }),
    userId
      ? prisma.collectionItem.findMany({
          where: { userId, quantity: { gt: 0 }, variant: { setId: { not: null } } },
          select: { variant: { select: { setId: true, cardId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const ownedKeys = new Set(items.map((i) => `${i.variant.setId}:${i.variant.cardId}`));
  const cardsBySet = new Map<string, Set<string>>();
  for (const v of variants) {
    if (!v.setId || isExcludedFromCompletion(v.card.rarity.code)) continue;
    const entry = cardsBySet.get(v.setId) ?? new Set<string>();
    entry.add(v.cardId);
    cardsBySet.set(v.setId, entry);
  }

  return sets.map((s) => {
    const cardIds = cardsBySet.get(s.id) ?? new Set<string>();
    const owned = [...cardIds].filter((cardId) => ownedKeys.has(`${s.id}:${cardId}`)).length;
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      total: cardIds.size,
      owned,
      pct: cardIds.size > 0 ? Math.round((owned / cardIds.size) * 100) : 0,
    };
  });
}

/** Classeur complet (possédé / manquant par carte). userId null = visiteur (tout en manquant). */
export async function getUserCollection(userId: string | null, filters: CollectionFilters): Promise<CollectionView> {
  const [cards, items, versionTypes, totalVariants, sets] = await Promise.all([
    prisma.card.findMany({
      orderBy: { number: "asc" },
      include: { rarity: true, season: true, variants: { include: { versionType: true, set: true } } },
    }),
    userId
      ? prisma.collectionItem.findMany({
          where: { userId },
          include: { variant: { include: { versionType: true, card: true } } },
        })
      : Promise.resolve([]),
    prisma.versionType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.cardVariant.count(),
    prisma.cardSet.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const activeSet = filters.set ? (sets.find((s) => s.code === filters.set) ?? null) : null;

  const vtCodes = new Map(versionTypes.map((v) => [v.id, v.code]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const ownedByCard = new Map<string, { qty: number; bySet: Map<string, number>; versions: Set<string> }>();

  for (const item of items) {
    const cardId = item.variant.cardId;
    const cur = ownedByCard.get(cardId) ?? { qty: 0, bySet: new Map<string, number>(), versions: new Set<string>() };
    cur.qty += item.quantity;
    const code = vtCodes.get(item.variant.versionTypeId);
    if (code) cur.versions.add(code);
    const setId = item.variant.setId;
    if (setId) cur.bySet.set(setId, (cur.bySet.get(setId) ?? 0) + item.quantity);
    ownedByCard.set(cardId, cur);
  }

  const enriched: CollectionCard[] = cards.map((card) => {
    const meta = rarityMeta(card.rarity.code);
    const own = ownedByCard.get(card.id);
    // Quantité/possession affichées dans le périmètre de la collection active,
    // sinon toutes déclinaisons confondues.
    const scopedQty = activeSet ? (own?.bySet.get(activeSet.id) ?? 0) : (own?.qty ?? 0);
    const owned = scopedQty > 0;
    // Sur une collection active, le « + » doit viser SA déclinaison.
    const scopedVariants = activeSet ? card.variants.filter((v) => v.setId === activeSet.id) : card.variants;
    const standardVariant = scopedVariants.find((v) => v.versionType.code === "standard");
    const imageFile =
      (activeSet ? scopedVariants.find((v) => v.imageUrl)?.imageUrl : null) ??
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
      quantity: scopedQty,
      standardVariantId: standardVariant?.id ?? scopedVariants[0]?.id ?? card.variants[0]?.id ?? "",
      isPromo: isPromoRarity(card.rarity.code),
      numberLabel: cardNumberLabel(card.number, card.rarity.code, card.season.code, {
        seriesCode: card.season.seriesCode,
        setSeriesCode: activeSet?.seriesCode ?? null,
      }),
      dots: card.variants
        .filter((v) => isActiveVersionCode(v.versionType.code))
        .map((v) => ({
        code: v.versionType.code,
        owned: own?.versions.has(v.versionType.code) ?? false,
      })),
    };
  });

  const inActiveSet = (cardId: string) =>
    !activeSet || (cardById.get(cardId)?.variants.some((v) => v.setId === activeSet.id) ?? false);

  const q = filters.q?.trim().toLowerCase();
  const filtered = enriched.filter((c) => {
    const card = cardById.get(c.cardId);
    if (!card) return false;
    if (filters.segment === "owned" && !c.owned) return false;
    if (filters.segment === "missing" && c.owned) return false;
    if (filters.rarity && card.rarity.code !== filters.rarity) return false;
    if (filters.season && card.season.code !== filters.season) return false;
    if (!inActiveSet(c.cardId)) return false;
    if (q) {
      const nameMatch = c.name.toLowerCase().includes(q);
      const numPadded = String(c.number).padStart(2, "0");
      const numMatch = numPadded.includes(q);
      const promoMatch = q.includes("promo") && isPromoRarity(card.rarity.code);
      const hsMatch = q.includes("hs") && card.season.code === "HS";
      // Recherche par code série : "mf" (toute la série), "mf-03" (série + numéro),
      // et les mêmes formes sur les initiales des collections ("chr", "chr-03").
      const seriesCodes = [
        card.season.seriesCode,
        ...card.variants.map((v) => v.set?.seriesCode ?? null),
      ].filter(Boolean) as string[];
      const seriesMatch = seriesCodes.some((raw) => {
        const series = raw.toLowerCase();
        return [series, `${series}-${numPadded}`].some((tok) => tok.includes(q));
      });
      if (!nameMatch && !numMatch && !promoMatch && !hsMatch && !seriesMatch) return false;
    }
    return true;
  });

  // Base de calcul : filtrée par saison / collection si un axe est actif, sinon tout le catalogue.
  // Exclut "unique" et "signed" du taux de complétion (trop rares pour atteindre 100%).
  const contextBase = enriched.filter((c) => {
    const card = cardById.get(c.cardId);
    if (!card || isExcludedFromCompletion(card.rarity.code)) return false;
    if (filters.season && card.season.code !== filters.season) return false;
    if (!inActiveSet(c.cardId)) return false;
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

  // Taux de complétion globaux par saison (calculés toujours sur l'ensemble du catalogue).
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

  // Idem par collection : compté sur les cartes qui y ont une déclinaison, et sur
  // la possession de CETTE déclinaison — posséder la carte de base ne complète
  // pas la collection.
  const setPcts: SetCompletion[] = sets.map((s) => {
    const scoped = enriched.filter((c) => {
      const card = cardById.get(c.cardId);
      return (
        card &&
        !isExcludedFromCompletion(card.rarity.code) &&
        card.variants.some((v) => v.setId === s.id)
      );
    });
    const owned = scoped.filter((c) => (ownedByCard.get(c.cardId)?.bySet.get(s.id) ?? 0) > 0).length;
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      total: scoped.length,
      owned,
      pct: scoped.length > 0 ? Math.round((owned / scoped.length) * 100) : 0,
    };
  });

  return {
    overallPct,
    overallOwned: ownedCards,
    totalVariants,
    rarityBars,
    sections,
    counts: { all: contextBase.length, owned: ownedCards, missing: missingCards },
    seasonPcts,
    setPcts,
  };
}

/** Quantités possédées par code de rareté, toutes saisons confondues (y compris hors série). */
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

/** Numéros de cartes possédées par le membre (au moins 1 exemplaire). */
export async function getViewerOwnedCardNumbers(userId: string): Promise<number[]> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: { variant: { select: { card: { select: { number: true } } } } },
  });
  return [...new Set(items.map((item) => item.variant.card.number))];
}

/** Complétion d'un membre (profil public). */
export async function getUserCompletion(userId: string) {
  const [owned, total] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.cardVariant.count(),
  ]);
  return { owned, total, pct: total > 0 ? Math.round((owned / total) * 100) : 0 };
}
