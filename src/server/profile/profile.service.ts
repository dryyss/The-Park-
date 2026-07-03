import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getUserCollection, type SeasonCompletion } from "@/server/collection/collection.service";
import type { AdminRole, Language } from "@/generated/prisma/client";
import { getDefaultDashboardForStaffRole } from "@/server/auth/roles.definition";
import { badgeIcon, badgeSortIndex } from "@/lib/badges";

export interface ProfileBadge {
  code: string;
  name: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export interface ProfileReview {
  id: string;
  authorName: string;
  authorInitial: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface ViewerProfile {
  id: string;
  displayName: string;
  slug: string;
  initial: string;
  rating: string;
  reviews: number;
  owned: number;
  total: number;
  pct: number;
  estimatedValue: string;
  exchangeCount: number;
  listingCount: number;
  memberSince: Date;
  staffRole: AdminRole | null;
  staffDashboardHref: string | null;
  rarityBars: { code: string; label: string; glyph: string; color: string; owned: number; total: number; pct: number }[];
  seasonPcts: SeasonCompletion[];
  badges: ProfileBadge[];
  recentReviews: ProfileReview[];
}

export async function getViewerProfile(userId: string): Promise<ViewerProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      slug: true,
      ratingAvg: true,
      reviewCount: true,
      createdAt: true,
      staffRole: true,
      _count: {
        select: {
          exchangesInitiated: true,
          exchangesReceived: true,
          listings: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
  if (!user) return null;

  const [collection, items, allBadges, userBadges, reviews] = await Promise.all([
    getUserCollection(userId, { segment: "all" }),
    prisma.collectionItem.findMany({
      where: { userId },
      include: { variant: { include: { card: { select: { quoteValue: true } } } } },
    }),
    prisma.badge.findMany({ orderBy: { code: "asc" } }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.review.findMany({
      where: { targetId: userId, visibility: "PUBLIC" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { displayName: true } } },
    }),
  ]);

  const unlockedIds = new Set(userBadges.map((ub) => ub.badgeId));
  const estimated = items.reduce((sum, i) => sum + Number(i.variant.card.quoteValue) * i.quantity, 0);

  const badges: ProfileBadge[] = allBadges
    .map((b) => ({
      code: b.code,
      name: b.label,
      description: b.description ?? "",
      unlocked: unlockedIds.has(b.id),
      icon: b.icon ?? badgeIcon(b.code),
    }))
    .sort((a, b) => badgeSortIndex(a.code) - badgeSortIndex(b.code));

  const exchangeCount = user._count.exchangesInitiated + user._count.exchangesReceived;

  return {
    id: user.id,
    displayName: user.displayName,
    slug: user.slug,
    initial: user.displayName.charAt(0).toUpperCase(),
    rating: user.ratingAvg.toFixed(1).replace(".", ","),
    reviews: user.reviewCount,
    owned: collection.overallOwned,
    total: collection.totalVariants,
    pct: collection.overallPct,
    estimatedValue: formatPrice(estimated),
    exchangeCount,
    listingCount: user._count.listings,
    memberSince: user.createdAt,
    staffRole: user.staffRole,
    staffDashboardHref: user.staffRole ? getDefaultDashboardForStaffRole(user.staffRole) : null,
    rarityBars: collection.rarityBars,
    seasonPcts: collection.seasonPcts,
    badges,
    recentReviews: reviews.map((r) => ({
      id: r.id,
      authorName: r.author.displayName,
      authorInitial: r.author.displayName.charAt(0).toUpperCase(),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
  };
}

// ─── Mini-profil au survol d'un pseudo ────────────────────────────────────────

export interface UserHoverCard {
  slug: string;
  displayName: string;
  initial: string;
  avatarUrl: string | null;
  country: string | null; // code ISO-2 (null si non renseigné / profil privé)
  language: Language;
  rating: string;
  reviews: number;
  listingCount: number;
  memberSince: Date;
  staffRole: AdminRole | null;
  /** null si la collection est privée. */
  collection: { owned: number; total: number; pct: number } | null;
  badgeCount: number;
  topBadges: { code: string; name: string; icon: string }[];
}

/** Données condensées d'un membre pour le mini-profil affiché au survol de son pseudo. */
export async function getUserHoverCard(slug: string): Promise<UserHoverCard | null> {
  const user = await prisma.user.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      slug: true,
      avatarUrl: true,
      country: true,
      language: true,
      ratingAvg: true,
      reviewCount: true,
      createdAt: true,
      staffRole: true,
      collectionVisibility: true,
      _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!user) return null;

  const collectionPublic = user.collectionVisibility === "PUBLIC";
  const [collection, userBadges] = await Promise.all([
    collectionPublic ? getUserCollection(user.id, { segment: "all" }) : Promise.resolve(null),
    prisma.userBadge.findMany({
      where: { userId: user.id },
      orderBy: { unlockedAt: "desc" },
      include: { badge: { select: { code: true, label: true } } },
    }),
  ]);

  return {
    slug: user.slug,
    displayName: user.displayName,
    initial: user.displayName.charAt(0).toUpperCase(),
    avatarUrl: user.avatarUrl,
    country: user.country,
    language: user.language,
    rating: user.ratingAvg.toFixed(1).replace(".", ","),
    reviews: user.reviewCount,
    listingCount: user._count.listings,
    memberSince: user.createdAt,
    staffRole: user.staffRole,
    collection: collection
      ? { owned: collection.overallOwned, total: collection.totalVariants, pct: collection.overallPct }
      : null,
    badgeCount: userBadges.length,
    topBadges: userBadges.slice(0, 3).map((ub) => ({
      code: ub.badge.code,
      name: ub.badge.label,
      icon: badgeIcon(ub.badge.code),
    })),
  };
}
