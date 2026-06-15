import "server-only";
import { prisma } from "@/lib/prisma";

export interface TopCollector {
  rank: number;
  displayName: string;
  slug: string;
  initial: string;
  owned: number;
  total: number;
  ratio: number; // 0..1
}

/** Classement des collectionneurs par nombre de variantes possédées. */
export async function getTopCollectors(limit = 5): Promise<TopCollector[]> {
  const total = await prisma.cardVariant.count();

  const grouped = await prisma.collectionItem.groupBy({
    by: ["userId"],
    _count: { variantId: true },
    orderBy: { _count: { variantId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, displayName: true, slug: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g, i) => {
    const u = userById.get(g.userId);
    const owned = g._count.variantId;
    const name = u?.displayName ?? "—";
    return {
      rank: i + 1,
      displayName: name,
      slug: u?.slug ?? "",
      initial: name.charAt(0).toUpperCase(),
      owned,
      total,
      ratio: total > 0 ? owned / total : 0,
    };
  });
}

export interface ActivityItem {
  id: string;
  kind: "LISTING";
  actorName: string;
  cardName: string;
  price: unknown;
  at: Date;
}

/** Flux d'activité du park (dérivé des dernières annonces réelles). */
export async function getRecentActivity(limit = 5): Promise<ActivityItem[]> {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      seller: { select: { displayName: true } },
      variant: { include: { card: { select: { name: true } } } },
    },
  });

  return listings.map((l) => ({
    id: l.id,
    kind: "LISTING" as const,
    actorName: l.seller.displayName,
    cardName: l.variant.card.name,
    price: l.price,
    at: l.createdAt,
  }));
}

export type RankingCategory = "completion" | "reputation" | "exchanges";

export interface RankingRow {
  rank: number;
  displayName: string;
  slug: string;
  initial: string;
  value: string;
  subLabel: string;
  barPct: number;
  isViewer?: boolean;
}

export interface RankingsView {
  category: RankingCategory;
  podium: RankingRow[];
  rows: RankingRow[];
}

const RANK_COLORS = ["#E8B23A", "#C9C6BE", "#E8945A"];

/** Classements complets (complétion, réputation, échanges). */
export async function getRankings(category: RankingCategory, viewerSlug?: string): Promise<RankingsView> {
  const totalVariants = await prisma.cardVariant.count();

  const members = await prisma.user.findMany({
    where: { role: "MEMBER", status: "ACTIVE" },
    select: {
      id: true,
      displayName: true,
      slug: true,
      ratingAvg: true,
      reviewCount: true,
      _count: { select: { collectionItems: true, exchangesInitiated: true, exchangesReceived: true } },
    },
  });

  const withScore = members.map((m) => {
    const owned = m._count.collectionItems;
    const exchanges = m._count.exchangesInitiated + m._count.exchangesReceived;
    let raw = 0;
    let value = "";
    let sub = "";

    if (category === "completion") {
      raw = totalVariants > 0 ? (owned / totalVariants) * 100 : 0;
      value = `${Math.round(raw)} %`;
      sub = "complétion";
    } else if (category === "reputation") {
      raw = m.ratingAvg;
      value = `★ ${m.ratingAvg.toFixed(1).replace(".", ",")}`;
      sub = "note moyenne";
    } else {
      raw = exchanges;
      value = String(exchanges);
      sub = "échanges";
    }

    return { ...m, raw, value, sub, owned };
  });

  withScore.sort((a, b) => b.raw - a.raw);

  const max = category === "reputation" ? 5 : withScore[0]?.raw || 1;

  const rows: RankingRow[] = withScore.map((m, i) => ({
    rank: i + 1,
    displayName: m.displayName,
    slug: m.slug,
    initial: m.displayName.charAt(0).toUpperCase(),
    value: m.value,
    subLabel: m.sub,
    barPct: max > 0 ? Math.round((m.raw / max) * 100) : 0,
    isViewer: viewerSlug === m.slug,
  }));

  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd for layout
  const podium = podiumOrder
    .map((i) => rows[i])
    .filter(Boolean)
    .map((r, i) => ({ ...r, rank: podiumOrder[i] + 1 }));

  return { category, podium, rows: rows.slice(0, 10) };
}

export interface CollectorProfile {
  displayName: string;
  slug: string;
  initial: string;
  bio: string | null;
  rating: string;
  reviews: number;
  owned: number;
  total: number;
  pct: number;
  memberSince: Date;
}

export async function getCollectorProfile(slug: string): Promise<CollectorProfile | null> {
  const user = await prisma.user.findFirst({
    where: { slug, status: "ACTIVE", collectionVisibility: "PUBLIC" },
    select: { displayName: true, slug: true, bio: true, ratingAvg: true, reviewCount: true, createdAt: true, id: true },
  });
  if (!user) return null;

  const [owned, total] = await Promise.all([
    prisma.collectionItem.count({ where: { userId: user.id } }),
    prisma.cardVariant.count(),
  ]);

  return {
    displayName: user.displayName,
    slug: user.slug,
    initial: user.displayName.charAt(0).toUpperCase(),
    bio: user.bio,
    rating: user.ratingAvg.toFixed(1).replace(".", ","),
    reviews: user.reviewCount,
    owned,
    total,
    pct: total > 0 ? Math.round((owned / total) * 100) : 0,
    memberSince: user.createdAt,
  };
}
