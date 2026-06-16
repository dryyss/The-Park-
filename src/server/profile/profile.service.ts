import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getUserCollection } from "@/server/collection/collection.service";
import type { AdminRole } from "@/generated/prisma/client";
import { getDefaultDashboardForStaffRole } from "@/server/auth/roles.definition";

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
  badges: ProfileBadge[];
  recentReviews: ProfileReview[];
}

const BADGE_ICONS: Record<string, string> = {
  first_card: "01",
  first_holo: "✦",
  set_gold: "✸",
  unique_owner: "✪",
  first_trade: "⇄",
  full_season: "100",
};

/** Profil privé du membre connecté (ou démo). */
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

  const badges: ProfileBadge[] = allBadges.map((b) => ({
    code: b.code,
    name: b.label,
    description: b.description ?? "",
    unlocked: unlockedIds.has(b.id),
    icon: BADGE_ICONS[b.code] ?? "★",
  }));

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
