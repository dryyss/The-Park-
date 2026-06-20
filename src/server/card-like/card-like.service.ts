import "server-only";
import { prisma } from "@/lib/prisma";

export interface CardLikeMeta {
  count: number;
  liked: boolean;
}

/** Compteur + état « liké » pour une liste de cartes (viewer optionnel). */
export async function getCardsLikeMeta(
  cardIds: string[],
  viewerUserId?: string | null,
): Promise<Map<string, CardLikeMeta>> {
  const unique = [...new Set(cardIds.filter(Boolean))];
  const result = new Map<string, CardLikeMeta>();
  if (unique.length === 0) return result;

  const [grouped, viewerLikes] = await Promise.all([
    prisma.cardLike.groupBy({
      by: ["cardId"],
      where: { cardId: { in: unique } },
      _count: { _all: true },
    }),
    viewerUserId
      ? prisma.cardLike.findMany({
          where: { userId: viewerUserId, cardId: { in: unique } },
          select: { cardId: true },
        })
      : Promise.resolve([]),
  ]);

  const countByCard = new Map(grouped.map((g) => [g.cardId, g._count._all]));
  const likedSet = new Set(viewerLikes.map((l) => l.cardId));

  for (const id of unique) {
    result.set(id, { count: countByCard.get(id) ?? 0, liked: likedSet.has(id) });
  }
  return result;
}

export async function getCardLikeMeta(cardId: string, viewerUserId?: string | null): Promise<CardLikeMeta> {
  const map = await getCardsLikeMeta([cardId], viewerUserId);
  return map.get(cardId) ?? { count: 0, liked: false };
}
