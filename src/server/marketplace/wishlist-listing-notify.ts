import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";

/** Notifie les membres dont la wishlist contient la carte listée sur le marketplace. */
export async function notifyWishlistForNewListing(
  listingId: string,
  sellerId: string,
  variantId: string,
): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    select: {
      cardId: true,
      card: { select: { name: true, slug: true } },
    },
  });
  if (!variant) return;

  const wishlistUsers = await prisma.wishlistItem.findMany({
    where: { cardId: variant.cardId, userId: { not: sellerId } },
    select: { userId: true },
    distinct: ["userId"],
  });

  await Promise.all(
    wishlistUsers.map(({ userId }) =>
      dispatchNotification({
        userId,
        type: "WISHLIST_LISTING",
        actorId: sellerId,
        entityType: "listing",
        entityId: listingId,
        payload: {
          cardName: variant.card.name,
          cardSlug: variant.card.slug,
        },
      }),
    ),
  );
}
