import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { dispatchNotification } from "@/server/notification/notification.mutations";

function toNum(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

/**
 * Notifie les membres dont la wishlist contient la carte listée sur le marketplace.
 *
 * Deux cas :
 * - **Alerte prix** (`WISHLIST_PRICE_DROP`) : le membre a fixé un seuil et l'annonce
 *   est à ce prix ou moins → notification prioritaire ciblée.
 * - **Disponibilité** (`WISHLIST_LISTING`) : le membre n'a pas de seuil → simple
 *   signalement de mise en vente.
 *
 * Un membre avec seuil n'est pas notifié pour une annonce au-dessus de son seuil ni
 * pour une annonce sans prix (échange pur) : cela éviterait le bruit qu'il cherche à
 * fuir en fixant une alerte.
 */
export async function notifyWishlistForNewListing(
  listingId: string,
  sellerId: string,
): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { type: true, price: true, variant: { select: { cardId: true, card: { select: { name: true, slug: true } } } } },
  });
  if (!listing) return;
  // Une annonce « je recherche » n'est pas une mise à disposition : rien à signaler.
  if (listing.type === "WANT") return;

  const cardId = listing.variant.cardId;
  const cardName = listing.variant.card.name;
  const cardSlug = listing.variant.card.slug;
  const price = toNum(listing.price);

  const items = await prisma.wishlistItem.findMany({
    where: { cardId, userId: { not: sellerId } },
    select: { userId: true, alertPrice: true },
  });
  if (items.length === 0) return;

  // Regrouper par membre : seuil d'alerte le plus bas (le plus exigeant).
  const byUser = new Map<string, { minAlert: number | null }>();
  for (const it of items) {
    const alert = toNum(it.alertPrice);
    const current = byUser.get(it.userId);
    if (!current) {
      byUser.set(it.userId, { minAlert: alert });
    } else if (alert != null && (current.minAlert == null || alert < current.minAlert)) {
      current.minAlert = alert;
    }
  }

  await Promise.all(
    [...byUser.entries()].map(([userId, { minAlert }]) => {
      const hasAlert = minAlert != null;

      if (hasAlert) {
        // Seuil fixé : ne notifier que si l'annonce a un prix qui l'atteint.
        if (price == null || price > minAlert) return Promise.resolve("");
        return dispatchNotification({
          userId,
          type: "WISHLIST_PRICE_DROP",
          actorId: sellerId,
          entityType: "listing",
          entityId: listingId,
          payload: {
            cardName,
            cardSlug,
            price: formatPrice(price),
            alertPrice: formatPrice(minAlert),
          },
        });
      }

      // Pas de seuil : simple disponibilité.
      return dispatchNotification({
        userId,
        type: "WISHLIST_LISTING",
        actorId: sellerId,
        entityType: "listing",
        entityId: listingId,
        payload: { cardName, cardSlug, ...(price != null ? { price: formatPrice(price) } : {}) },
      });
    }),
  );
}
