import "server-only";
import { prisma } from "@/lib/prisma";
import type { SaleStatus } from "@/generated/prisma/client";
import { dispatchNotification } from "@/server/notification/notification.mutations";

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
  listingCount: number;
  salesAsSeller: number;
  salesAsBuyer: number;
  topUpCount: number;
};

async function loadBadgeMetrics(userId: string): Promise<BadgeMetrics> {
  const [items, exchangeCount, goldCards, seasonCards, listingCount, salesAsSeller, salesAsBuyer, topUpCount] =
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
        where: { rarity: { code: "g" } },
        select: { id: true },
      }),
      prisma.card.findMany({
        where: { season: { code: "S01" } },
        select: { id: true },
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

  const goldComplete =
    goldCards.length > 0 && goldCards.every((c) => ownedCardIds.has(c.id));

  const seasonOwned = seasonCards.filter((c) => ownedCardIds.has(c.id)).length;
  const seasonComplete = seasonCards.length > 0 && seasonOwned === seasonCards.length;

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
    goldComplete,
    uniqueOwned,
    legendaryOwned,
    ultraRareOwned,
    seasonComplete,
    listingCount,
    salesAsSeller,
    salesAsBuyer,
    topUpCount,
  };
}

function buildBadgeRules(m: BadgeMetrics): Record<string, boolean> {
  const tradeDone = m.exchangeCount >= 1 || m.salesAsSeller >= 1 || m.salesAsBuyer >= 1;

  return {
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
}

/** Évalue et débloque les badges automatiques pour un membre. */
export async function evaluateUserBadges(userId: string): Promise<string[]> {
  const unlocked: string[] = [];

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
