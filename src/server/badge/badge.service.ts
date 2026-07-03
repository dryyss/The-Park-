import "server-only";
import { prisma } from "@/lib/prisma";
import type { SaleStatus } from "@/generated/prisma/client";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { BADGE_DEFINITIONS } from "@/lib/badges";
import { isFirstEditionLabel, resolveEditionLabel } from "@/lib/card-edition";
import { RARITY_DEFINITIONS } from "@/lib/rarities";

/** Code de la saison « Moteur Forgé » (Saison 1). */
const S01 = "S01";

/** Fenêtre « sniper » : mise gagnante placée dans les 15 dernières secondes. */
const SNIPER_WINDOW_MS = 15 * 1000;
/** Fenêtre « gommards neufs » : achat dans les 5 minutes après la mise en ligne. */
const QUICK_BUY_WINDOW_MS = 5 * 60 * 1000;
/** « Flambeur de Tokyo » : enchère remportée avec plus de 10 mises. */
const CONTESTED_BID_COUNT = 10;
/** « Roi de la Glisse » : jours consécutifs au top 3. */
const TOP3_STREAK_DAYS = 7;

/**
 * Aligne la table Badge sur le catalogue client (src/lib/badges.ts) :
 * crée les manquants, met à jour libellés/descriptions/icônes,
 * supprime les badges hérités absents de la liste (et leurs déblocages).
 */
export async function syncBadgeCatalog(): Promise<void> {
  const existing = await prisma.badge.findMany();
  const byCode = new Map(existing.map((b) => [b.code, b]));

  const missing = BADGE_DEFINITIONS.filter((d) => !byCode.has(d.code));
  if (missing.length > 0) {
    await prisma.badge.createMany({
      data: missing.map(({ code, label, description, icon }) => ({ code, label, description, icon })),
      skipDuplicates: true,
    });
  }

  for (const d of BADGE_DEFINITIONS) {
    const b = byCode.get(d.code);
    if (b && (b.label !== d.label || b.description !== d.description || b.icon !== d.icon)) {
      await prisma.badge.update({
        where: { code: d.code },
        data: { label: d.label, description: d.description, icon: d.icon },
      });
    }
  }

  const validCodes = new Set(BADGE_DEFINITIONS.map((d) => d.code));
  const obsoleteIds = existing.filter((b) => !validCodes.has(b.code)).map((b) => b.id);
  if (obsoleteIds.length > 0) {
    await prisma.userBadge.deleteMany({ where: { badgeId: { in: obsoleteIds } } });
    await prisma.badge.deleteMany({ where: { id: { in: obsoleteIds } } });
  }
}

/** Compat : ancien nom utilisé par le seed / d'éventuels appels externes. */
export const syncCatalogBadges = syncBadgeCatalog;

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

/** Normalise un nom de carte pour la recherche (majuscules/accents ignorés). */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

const RARITY_RANK = new Map<string, number>(RARITY_DEFINITIONS.map((r) => [r.code, r.sortOrder]));

type BadgeMetrics = {
  distinctCards: number;
  distinctVariants: number;
  s01Complete: boolean;
  tofuMaxRarity: boolean;
  skylineAllVersions: boolean;
  rotatifOwned: boolean;
  uniqueOwned: boolean;
  promoOwned: boolean;
  profileComplete: boolean;
  exchangesProposed: number;
  exchangesCompleted: number;
  purchases: number;
  salesTotal: number;
  quickBuy: boolean;
  sniperWin: boolean;
  contestedWin: boolean;
  rank: number | null;
  top3StreakDays: number;
  // 1ère édition / réédition (sets de cardIds possédés par édition)
  feS01Any: boolean;
  feCommonCount: number;
  feLegendaryAny: boolean;
  feGoldAny: boolean;
  reS01Count: number;
  reRaresComplete: boolean;
  reS01Complete: boolean;
  editionPairs: number;
  ultraDoubleComplete: boolean;
};

/** Rang « Top Collectionneurs » (mêmes critères que le classement public). */
async function getCollectorRank(userId: string): Promise<number | null> {
  const grouped = await prisma.collectionItem.groupBy({
    by: ["userId"],
    where: { user: { role: "MEMBER", status: "ACTIVE" } },
    _count: { variantId: true },
  });
  const mine = grouped.find((g) => g.userId === userId)?._count.variantId ?? 0;
  if (mine === 0) return null;
  return grouped.filter((g) => g._count.variantId > mine).length + 1;
}

/**
 * Met à jour la série de jours consécutifs au top 3 (une comptée par jour civil).
 * La série avance quand l'utilisateur est évalué (action, visite, cron quotidien) ;
 * un jour sans évaluation au top 3 remet la série à zéro.
 */
async function updateTop3Streak(userId: string, rank: number | null): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const existing = await prisma.rankStreak.findUnique({ where: { userId } });
  if (existing?.lastDayKey === today) return existing.days;

  const inTop3 = rank != null && rank <= 3;
  const days = inTop3 ? (existing?.lastDayKey === yesterday && existing.days > 0 ? existing.days + 1 : 1) : 0;

  await prisma.rankStreak.upsert({
    where: { userId },
    update: { days, lastDayKey: today },
    create: { userId, days, lastDayKey: today },
  });
  return days;
}

async function loadBadgeMetrics(userId: string): Promise<BadgeMetrics> {
  const [items, catalogCards, user, exchangesProposed, exchangesCompleted, purchases, salesAgg, buyerSales, wonAuctions, rank] =
    await Promise.all([
      prisma.collectionItem.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: {
          variant: {
            include: {
              versionType: { select: { code: true } },
              card: { include: { rarity: { select: { code: true } }, season: { select: { code: true } } } },
            },
          },
        },
      }),
      prisma.card.findMany({
        select: {
          id: true,
          name: true,
          isUnique: true,
          rarity: { select: { code: true } },
          season: { select: { code: true } },
          variants: { select: { id: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, avatarUrl: true, bio: true },
      }),
      prisma.exchange.count({ where: { initiatorId: userId } }),
      prisma.exchange.count({
        where: { OR: [{ initiatorId: userId }, { recipientId: userId }], status: "COMPLETED" },
      }),
      prisma.sale.count({ where: { buyerId: userId, status: { in: SUCCESSFUL_SALE_STATUSES } } }),
      prisma.sale.aggregate({
        _sum: { price: true },
        where: { sellerId: userId, status: { in: SUCCESSFUL_SALE_STATUSES } },
      }),
      prisma.sale.findMany({
        where: { buyerId: userId, status: { in: SUCCESSFUL_SALE_STATUSES } },
        select: { createdAt: true, listing: { select: { createdAt: true } } },
      }),
      prisma.auction.findMany({
        where: { winnerId: userId, status: "SOLD" },
        select: {
          endsAt: true,
          _count: { select: { bids: true } },
          bids: { orderBy: { amount: "desc" }, take: 1, select: { createdAt: true, bidderId: true } },
        },
      }),
      getCollectorRank(userId),
    ]);

  // ── Possessions ────────────────────────────────────────────────────────────
  const ownedCardIds = new Set<string>();
  const ownedVariantIds = new Set<string>();
  const feCards = new Set<string>(); // cardIds possédés en 1ère édition
  const reCards = new Set<string>(); // cardIds possédés en réédition
  let uniqueOwned = false;
  let promoOwned = false;

  for (const item of items) {
    const { card } = item.variant;
    ownedCardIds.add(card.id);
    ownedVariantIds.add(item.variantId);

    if (card.rarity.code === "unique" || card.isUnique || item.variant.versionType.code === "unique") uniqueOwned = true;
    if (card.rarity.code === "promotional" || item.variant.versionType.code === "promotional") promoOwned = true;

    const edition = resolveEditionLabel(item.editionLabel, item.variant.editionLabel);
    if (isFirstEditionLabel(edition)) feCards.add(card.id);
    else if (edition != null) reCards.add(card.id);
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const s01Ids: string[] = [];
  const s01RareIds: string[] = [];
  const ultraIds: string[] = [];
  const rarityByCard = new Map<string, string>();
  let bestTruenoId: string | null = null;
  let bestTruenoRank = -1;
  const skylineCards: { id: string; variantIds: string[] }[] = [];
  let rotatifId: string | null = null;

  for (const c of catalogCards) {
    rarityByCard.set(c.id, c.rarity.code);
    if (c.season.code === S01) {
      s01Ids.push(c.id);
      if (c.rarity.code === "r") s01RareIds.push(c.id);
    }
    if (c.rarity.code === "u") ultraIds.push(c.id);

    const name = normalizeName(c.name);
    if (name.includes("AE86 TRUENO")) {
      const rankValue = RARITY_RANK.get(c.rarity.code) ?? -1;
      if (rankValue > bestTruenoRank) {
        bestTruenoRank = rankValue;
        bestTruenoId = c.id;
      }
    }
    if (name.includes("SKYLINE")) skylineCards.push({ id: c.id, variantIds: c.variants.map((v) => v.id) });
    if (name.includes("RX7 FD PREPAREE")) rotatifId = c.id;
  }

  const complete = (ids: string[], owned: Set<string>) => ids.length > 0 && ids.every((id) => owned.has(id));

  // ── Enchères / marketplace ────────────────────────────────────────────────
  const sniperWin = wonAuctions.some(
    (a) =>
      a.bids[0] != null &&
      a.bids[0].bidderId === userId &&
      a.endsAt.getTime() - a.bids[0].createdAt.getTime() <= SNIPER_WINDOW_MS,
  );
  const contestedWin = wonAuctions.some((a) => a._count.bids > CONTESTED_BID_COUNT);
  const quickBuy = buyerSales.some(
    (s) => s.createdAt.getTime() - s.listing.createdAt.getTime() <= QUICK_BUY_WINDOW_MS,
  );

  const top3StreakDays = await updateTop3Streak(userId, rank);

  const editionPairs = [...feCards].filter((id) => reCards.has(id)).length;

  return {
    distinctCards: ownedCardIds.size,
    distinctVariants: ownedVariantIds.size,
    s01Complete: complete(s01Ids, ownedCardIds),
    tofuMaxRarity: bestTruenoId != null && ownedCardIds.has(bestTruenoId),
    skylineAllVersions: skylineCards.some(
      (c) => c.variantIds.length > 0 && c.variantIds.every((v) => ownedVariantIds.has(v)),
    ),
    rotatifOwned: rotatifId != null && ownedCardIds.has(rotatifId),
    uniqueOwned,
    promoOwned,
    profileComplete: !!user?.displayName?.trim() && !!user?.avatarUrl?.trim() && !!user?.bio?.trim(),
    exchangesProposed,
    exchangesCompleted,
    purchases,
    salesTotal: Number(salesAgg._sum.price ?? 0),
    quickBuy,
    sniperWin,
    contestedWin,
    rank,
    top3StreakDays,
    feS01Any: [...feCards].some((id) => s01Ids.includes(id)),
    feCommonCount: [...feCards].filter((id) => rarityByCard.get(id) === "c").length,
    feLegendaryAny: [...feCards].some((id) => rarityByCard.get(id) === "l"),
    feGoldAny: [...feCards].some((id) => rarityByCard.get(id) === "g"),
    reS01Count: [...reCards].filter((id) => s01Ids.includes(id)).length,
    reRaresComplete: complete(s01RareIds, reCards),
    reS01Complete: complete(s01Ids, reCards),
    editionPairs,
    ultraDoubleComplete: complete(ultraIds, feCards) && complete(ultraIds, reCards),
  };
}

function buildBadgeRules(m: BadgeMetrics): Record<string, boolean> {
  return {
    // 🔰 Permis Apprenti
    apprenti_contact_mis: m.distinctCards >= 1,
    apprenti_premier_run: m.purchases >= 1,
    apprenti_controle_technique: m.profileComplete,
    apprenti_appel_de_phares: m.exchangesProposed >= 1,

    // 🔧 Le Garage Parfait
    garage_puriste_du_bloc: m.s01Complete,
    garage_tofu_delivery: m.tofuMaxRarity,
    garage_eveil_du_godzilla: m.skylineAllVersions,
    garage_moteur_serre: m.distinctVariants >= 100,
    garage_rotatif_hurlant: m.rotatifOwned,

    // 💸 Le Loup de Shibuya
    shibuya_sniper_de_l_ombre: m.sniperWin,
    shibuya_business_de_touge: m.exchangesCompleted >= 10,
    shibuya_billet_violet: m.salesTotal >= 500,
    shibuya_gommards_neufs: m.quickBuy,
    shibuya_flambeur_de_tokyo: m.contestedWin,

    // 👑 Roi du Park
    roi_midnight_club: m.rank != null && m.rank <= 5,
    roi_drift_king: m.rank === 1,
    roi_saint_graal: m.uniqueOwned,
    roi_de_la_glisse: m.top3StreakDays >= TOP3_STREAK_DAYS,

    // 🥇 L'Héritage de la 1ère Édition
    heritage_pionnier_du_park: m.feS01Any,
    heritage_archeologue_du_bitume: m.feCommonCount >= 10,
    heritage_saint_graal_forge: m.feLegendaryAny,
    heritage_age_d_or_du_drift: m.feGoldAny,

    // 🔄 Maître de la Réédition
    reedition_moteur_echange_standard: m.reS01Count >= 50,
    reedition_flotte_complete: m.reRaresComplete,
    reedition_seconde_jeunesse: m.reS01Complete,

    // 🪞 Double Turbo
    turbo_miroir_jdm: m.editionPairs >= 1,
    turbo_garage_bipolaire: m.editionPairs >= 15,
    turbo_vision_peripherique: m.ultraDoubleComplete,

    // 🏁 Les Succès Spéciaux du Set
    special_elu_du_touge: m.uniqueOwned,
    special_culture_de_l_ombre: m.promoOwned,
  };
}

/** Évalue et débloque les succès automatiques pour un membre. */
export async function evaluateUserBadges(userId: string): Promise<string[]> {
  const unlocked: string[] = [];

  // S'assure que le catalogue de succès est à jour avant d'évaluer.
  await syncBadgeCatalog();

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

/**
 * Évalue quotidiennement les membres du haut du classement (cron de maintenance)
 * pour que les succès de rang (Midnight Club, Drift King, Roi de la Glisse)
 * se débloquent automatiquement, sans attendre une visite du membre.
 */
export async function evaluateLeaderboardBadges(): Promise<number> {
  const grouped = await prisma.collectionItem.groupBy({
    by: ["userId"],
    where: { user: { role: "MEMBER", status: "ACTIVE" } },
    _count: { variantId: true },
    orderBy: { _count: { variantId: "desc" } },
    take: 5,
  });
  await evaluateUserBadgesForUsers(grouped.map((g) => g.userId));
  return grouped.length;
}
