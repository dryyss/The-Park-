import "server-only";
import { unstable_cache } from "next/cache";
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
async function fetchTopCollectors(limit: number): Promise<TopCollector[]> {
  const total = await prisma.cardVariant.count();

  // Mêmes critères que le classement complet : on exclut les comptes non-membres
  // (boutique officielle / admin) pour rester cohérent avec /classements.
  const grouped = await prisma.collectionItem.groupBy({
    by: ["userId"],
    where: { user: { role: "MEMBER", status: "ACTIVE" } },
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

export async function getTopCollectors(limit = 5): Promise<TopCollector[]> {
  return unstable_cache(() => fetchTopCollectors(limit), ["top-collectors", String(limit)], {
    revalidate: 60,
    tags: ["rankings"],
  })();
}

/** Type d'événement affiché dans le flux — calque sur Listing.type. */
export type ActivityKind = "SELL" | "TRADE" | "WANT";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  actorName: string;
  cardName: string;
  /** Renseigné pour SELL / TRADE ; null pour WANT (recherche). */
  price: unknown;
  at: Date;
}

/** Flux d'activité du park (dérivé des dernières annonces réelles). */
async function fetchRecentActivity(limit: number): Promise<ActivityItem[]> {
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
    kind: l.type === "WANT" ? "WANT" : l.type === "SELL_OR_TRADE" ? "TRADE" : "SELL",
    actorName: l.seller.displayName,
    cardName: l.variant.card.name,
    price: l.type === "WANT" ? null : l.price,
    at: l.createdAt,
  }));
}

export async function getRecentActivity(limit = 5): Promise<ActivityItem[]> {
  return unstable_cache(() => fetchRecentActivity(limit), ["recent-activity", String(limit)], {
    revalidate: 30,
    tags: ["listings"],
  })();
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
  page: number;
  pageCount: number;
  total: number;
  /** Rang global du viewer (1-based) s'il figure au classement, sinon null. */
  viewerRank: number | null;
}

const PAGE_SIZE = 20;

/** Lignes de classement globales (sans viewer) — identiques pour tous, donc mises en cache. */
async function fetchRankingRows(category: RankingCategory): Promise<RankingRow[]> {
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

  return withScore.map((m, i) => ({
    rank: i + 1,
    displayName: m.displayName,
    slug: m.slug,
    initial: m.displayName.charAt(0).toUpperCase(),
    value: m.value,
    subLabel: m.sub,
    barPct: max > 0 ? Math.round((m.raw / max) * 100) : 0,
  }));
}

function getRankingRows(category: RankingCategory) {
  return unstable_cache(() => fetchRankingRows(category), ["ranking-rows", category], {
    revalidate: 60,
    tags: ["rankings"],
  })();
}

/** Classements complets (complétion, réputation, échanges), paginés + marquage du viewer. */
export async function getRankings(
  category: RankingCategory,
  viewerSlug?: string,
  page = 1,
): Promise<RankingsView> {
  const allRows = await getRankingRows(category);
  const mark = (r: RankingRow): RankingRow => ({ ...r, isViewer: viewerSlug === r.slug });

  // Podium en ordre naturel (1er, 2e, 3e) ; la mise en page (2e – 1er – 3e) est gérée par RankingsPodium.
  const podium = allRows.slice(0, 3).map(mark);

  const total = allRows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = allRows.slice(start, start + PAGE_SIZE).map(mark);

  const viewerRank = viewerSlug ? allRows.find((r) => r.slug === viewerSlug)?.rank ?? null : null;

  return { category, podium, rows: pageRows, page: current, pageCount, total, viewerRank };
}

export interface CollectorProfile {
  userId: string;
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
    userId: user.id,
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
