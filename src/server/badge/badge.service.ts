import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";

/** Évalue et débloque les badges automatiques pour un membre. */
export async function evaluateUserBadges(userId: string): Promise<string[]> {
  const unlocked: string[] = [];

  const [collectionCount, holoCount, exchangeCount, goldOwned, userBadges, allBadges] = await Promise.all([
    prisma.collectionItem.count({ where: { userId, quantity: { gt: 0 } } }),
    prisma.collectionItem.count({
      where: {
        userId,
        quantity: { gt: 0 },
        variant: { card: { rarity: { code: { in: ["r", "u", "l", "g"] } } } },
      },
    }),
    prisma.exchange.count({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
        status: "COMPLETED",
      },
    }),
    prisma.collectionItem.count({
      where: { userId, quantity: { gt: 0 }, variant: { card: { rarity: { code: "g" } } } },
    }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.badge.findMany(),
  ]);

  const ownedBadgeIds = new Set(userBadges.map((b) => b.badgeId));
  const rules: Record<string, boolean> = {
    first_card: collectionCount >= 1,
    first_holo: holoCount >= 1,
    first_trade: exchangeCount >= 1,
    set_gold: goldOwned >= 1,
    full_season: collectionCount >= 50,
  };

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
