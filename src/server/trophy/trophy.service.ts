import "server-only";
import { prisma } from "@/lib/prisma";

export interface TrophyBadge {
  code: string;
  label: string;
  description: string;
  icon: string | null;
  unlocked: boolean;
  progress: number;
  unlockedAt: Date | null;
}

const BADGE_ICONS: Record<string, string> = {
  first_card: "01",
  first_holo: "✦",
  set_gold: "✸",
  unique_owner: "✪",
  first_trade: "⇄",
  full_season: "100",
};

export async function getCatalogTrophies(): Promise<TrophyBadge[]> {
  const allBadges = await prisma.badge.findMany({ orderBy: { code: "asc" } });
  return allBadges.map((b) => ({
    code: b.code,
    label: b.label,
    description: b.description ?? "",
    icon: b.icon ?? BADGE_ICONS[b.code] ?? "★",
    unlocked: false,
    progress: 0,
    unlockedAt: null,
  }));
}

export async function getCatalogTrophyStats() {
  const total = await prisma.badge.count();
  return { total, unlocked: 0, pct: 0 };
}

export async function getViewerTrophies(userId: string): Promise<TrophyBadge[]> {
  const [allBadges, userBadges] = await Promise.all([
    prisma.badge.findMany({ orderBy: { code: "asc" } }),
    prisma.userBadge.findMany({ where: { userId } }),
  ]);

  const unlockedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub]));

  return allBadges.map((b) => {
    const ub = unlockedMap.get(b.id);
    return {
      code: b.code,
      label: b.label,
      description: b.description ?? "",
      icon: b.icon ?? BADGE_ICONS[b.code] ?? "★",
      unlocked: !!ub,
      progress: ub?.progress ?? 0,
      unlockedAt: ub?.unlockedAt ?? null,
    };
  });
}

export async function getTrophyStats(userId: string) {
  const [total, unlocked] = await Promise.all([
    prisma.badge.count(),
    prisma.userBadge.count({ where: { userId } }),
  ]);
  return { total, unlocked, pct: total > 0 ? Math.round((unlocked / total) * 100) : 0 };
}
