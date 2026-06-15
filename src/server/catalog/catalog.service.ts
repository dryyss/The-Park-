import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Couche service catalogue (.cursorrules : pas de Prisma direct dans les composants).
 * Résumé de la saison courante pour l'accueil / les tableaux de complétion.
 */
export async function getCatalogSummary() {
  const season = await prisma.season.findFirst({
    orderBy: { sortOrder: "asc" },
  });

  if (!season) {
    return { season: null, totalCards: 0, byRarity: [] as const };
  }

  const [totalCards, grouped, rarities] = await Promise.all([
    prisma.card.count({ where: { seasonId: season.id } }),
    prisma.card.groupBy({
      by: ["rarityId"],
      where: { seasonId: season.id },
      _count: { _all: true },
    }),
    prisma.rarity.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const countByRarity = new Map(grouped.map((g) => [g.rarityId, g._count._all]));

  const byRarity = rarities
    .map((r) => ({
      code: r.code,
      label: r.label,
      symbol: r.symbol,
      color: r.color,
      count: countByRarity.get(r.id) ?? 0,
    }))
    .filter((r) => r.count > 0);

  return { season, totalCards, byRarity };
}
