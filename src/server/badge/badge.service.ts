import "server-only";
import { prisma } from "@/lib/prisma";
import type { SaleStatus } from "@/generated/prisma/client";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { seasonBadgeCode, brandBadgeCode } from "@/lib/badges";

/** Saison de référence du badge historique « full_season » (= Série 1). Exclue de la génération dynamique. */
const LEGACY_SEASON_CODE = "S01";

/**
 * Garantit qu'un badge existe pour chaque saison (hors Série 1 historique) et chaque marque
 * du catalogue. Idempotent : ne crée que les badges manquants.
 */
export async function syncCatalogBadges(): Promise<void> {
  const [seasons, brandRows, existing] = await Promise.all([
    prisma.season.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, name: true } }),
    prisma.card.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      select: { brand: true },
    }),
    prisma.badge.findMany({ select: { code: true } }),
  ]);

  const existingCodes = new Set(existing.map((b) => b.code));
  const desired: { code: string; label: string; description: string }[] = [];

  seasons.forEach((s, idx) => {
    if (s.code === LEGACY_SEASON_CODE) return; // couverte par le badge historique full_season
    desired.push({
      code: seasonBadgeCode(s.code),
      label: `Série ${idx + 1} · ${s.name}`,
      description: `Compléter la saison « ${s.name} » à 100 %`,
    });
  });

  for (const { brand } of brandRows) {
    const name = brand?.trim();
    if (!name) continue;
    desired.push({
      code: brandBadgeCode(name),
      label: `Collection ${name}`,
      description: `Posséder toutes les cartes ${name} du catalogue`,
    });
  }

  const missing = desired.filter((b) => !existingCodes.has(b.code));
  if (missing.length > 0) {
    await prisma.badge.createMany({ data: missing, skipDuplicates: true });
  }

  // Aligne le badge historique « full_season » sur la nomenclature « Série 1 ».
  const legacySeason = seasons.find((s) => s.code === LEGACY_SEASON_CODE);
  if (legacySeason) {
    const label = `Série 1 · ${legacySeason.name}`;
    await prisma.badge.updateMany({
      where: { code: "full_season", NOT: { label } },
      data: { label, description: `Compléter la saison « ${legacySeason.name} » à 100 %` },
    });
  }
}

/** Vente marketplace effective (paiement validé ou au-delà). */
const SUCCESSFUL_SALE_STATUSES: SaleStatus[] = [
  "PAID",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "DELIVERED_WINDOW",
  "DELIVERED",
  "COMPLETED",
  "DISPUTED",
  "GUARANTEE_SUSPENDED",
];

type BadgeMetrics = {
  ownedCardIds: Set<string>;
  holoCards: number;
  exchangeCount: number;
  goldComplete: boolean;
  uniqueOwned: boolean;
  legendaryOwned: boolean;
  ultraRareOwned: boolean;
  seasonComplete: boolean;
  /** code saison → collection complète (toutes les cartes possédées). */
  seasonCompletion: Map<string, boolean>;
  /** marque → collection complète (toutes les cartes de la marque possédées). */
  brandCompletion: Map<string, boolean>;
  listingCount: number;
  salesAsSeller: number;
  salesAsBuyer: number;
  topUpCount: number;
};

/** Vrai si le groupe est non vide et intégralement possédé. */
function isComplete(cardIds: string[], owned: Set<string>): boolean {
  return cardIds.length > 0 && cardIds.every((id) => owned.has(id));
}

async function loadBadgeMetrics(userId: string): Promise<BadgeMetrics> {
  const [items, exchangeCount, catalogCards, listingCount, salesAsSeller, salesAsBuyer, topUpCount] =
    await Promise.all([
      prisma.collectionItem.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: { variant: { include: { card: { include: { rarity: true, season: true } } } } },
      }),
      prisma.exchange.count({
        where: {
          OR: [{ initiatorId: userId }, { recipientId: userId }],
          status: "COMPLETED",
        },
      }),
      prisma.card.findMany({
        select: {
          id: true,
          brand: true,
          rarity: { select: { code: true } },
          season: { select: { code: true } },
        },
      }),
      prisma.listing.count({ where: { sellerId: userId } }),
      prisma.sale.count({ where: { sellerId: userId, status: { in: SUCCESSFUL_SALE_STATUSES } } }),
      prisma.sale.count({ where: { buyerId: userId, status: { in: SUCCESSFUL_SALE_STATUSES } } }),
      prisma.walletLedgerEntry.count({ where: { wallet: { userId }, type: "TOP_UP" } }),
    ]);

  const ownedCardIds = new Set(items.map((i) => i.variant.cardId));
  const holoCards = new Set(
    items
      .filter((i) => ["r", "u", "l", "g"].includes(i.variant.card.rarity.code))
      .map((i) => i.variant.cardId),
  ).size;

  // Regroupe le catalogue par rareté / saison / marque pour les complétions.
  const goldIds: string[] = [];
  const bySeason = new Map<string, string[]>();
  const byBrand = new Map<string, string[]>();
  for (const c of catalogCards) {
    if (c.rarity.code === "g") goldIds.push(c.id);
    const seasonList = bySeason.get(c.season.code) ?? [];
    seasonList.push(c.id);
    bySeason.set(c.season.code, seasonList);
    const brand = c.brand?.trim();
    if (brand) {
      const brandList = byBrand.get(brand) ?? [];
      brandList.push(c.id);
      byBrand.set(brand, brandList);
    }
  }

  const seasonCompletion = new Map<string, boolean>();
  for (const [code, ids] of bySeason) seasonCompletion.set(code, isComplete(ids, ownedCardIds));
  const brandCompletion = new Map<string, boolean>();
  for (const [brand, ids] of byBrand) brandCompletion.set(brand, isComplete(ids, ownedCardIds));

  let uniqueOwned = false;
  let legendaryOwned = false;
  let ultraRareOwned = false;
  for (const item of items) {
    const { card } = item.variant;
    if (card.rarity.code === "unique" || card.isUnique) uniqueOwned = true;
    if (card.rarity.code === "l") legendaryOwned = true;
    if (card.rarity.code === "u") ultraRareOwned = true;
  }

  return {
    ownedCardIds,
    holoCards,
    exchangeCount,
    goldComplete: isComplete(goldIds, ownedCardIds),
    uniqueOwned,
    legendaryOwned,
    ultraRareOwned,
    seasonComplete: seasonCompletion.get("S01") ?? false,
    seasonCompletion,
    brandCompletion,
    listingCount,
    salesAsSeller,
    salesAsBuyer,
    topUpCount,
  };
}

function buildBadgeRules(m: BadgeMetrics): Record<string, boolean> {
  const tradeDone = m.exchangeCount >= 1 || m.salesAsSeller >= 1 || m.salesAsBuyer >= 1;

  const rules: Record<string, boolean> = {
    first_card: m.ownedCardIds.size >= 1,
    first_holo: m.holoCards >= 1,
    collector_25: m.ownedCardIds.size >= 25,
    legendary_owner: m.legendaryOwned,
    ultra_rare_owner: m.ultraRareOwned,
    set_gold: m.goldComplete,
    unique_owner: m.uniqueOwned,
    first_trade: tradeDone,
    exchange_veteran: m.exchangeCount >= 5,
    first_listing: m.listingCount >= 1,
    first_sale: m.salesAsSeller >= 1,
    first_purchase: m.salesAsBuyer >= 1,
    full_season: m.seasonComplete,
    wallet_pioneer: m.topUpCount >= 1,
  };

  // Badges dynamiques : complétion par série (hors Série 1 = full_season) et par marque.
  for (const [code, complete] of m.seasonCompletion) {
    if (code === LEGACY_SEASON_CODE) continue;
    rules[seasonBadgeCode(code)] = complete;
  }
  for (const [brand, complete] of m.brandCompletion) {
    rules[brandBadgeCode(brand)] = complete;
  }

  return rules;
}

/** Évalue et débloque les badges automatiques pour un membre. */
export async function evaluateUserBadges(userId: string): Promise<string[]> {
  const unlocked: string[] = [];

  // S'assure que les badges série/marque du catalogue existent avant d'évaluer.
  await syncCatalogBadges();

  const [metrics, userBadges, allBadges] = await Promise.all([
    loadBadgeMetrics(userId),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.badge.findMany(),
  ]);

  const ownedBadgeIds = new Set(userBadges.map((b) => b.badgeId));
  const rules = buildBadgeRules(metrics);

  for (const badge of allBadges) {
    if (ownedBadgeIds.has(badge.id)) continue;
    if (!rules[badge.code]) continue;

    await prisma.userBadge.create({ data: { userId, badgeId: badge.id, progress: 100 } });
    unlocked.push(badge.code);
    await dispatchNotification({
      userId,
      type: "BADGE_UNLOCKED",
      entityType: "BADGE",
      entityId: badge.id,
      payload: { code: badge.code, label: badge.label },
    });
  }

  return unlocked;
}

/** Variante tolérante aux erreurs pour les hooks métier. */
export async function evaluateUserBadgesSafe(userId: string): Promise<void> {
  try {
    await evaluateUserBadges(userId);
  } catch (err) {
    console.error("[badge:evaluate]", err);
  }
}

/** Évalue les badges pour plusieurs membres (dédupliqué). */
export async function evaluateUserBadgesForUsers(userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(unique.map((id) => evaluateUserBadgesSafe(id)));
}
