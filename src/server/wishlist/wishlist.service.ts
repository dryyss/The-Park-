import "server-only";
import { prisma } from "@/lib/prisma";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";

export interface WishlistCard {
  id: string;
  cardId: string;
  slug: string;
  name: string;
  number: number;
  image: string | null;
  rarityCode: string;
  rarityLabel: string;
  quoteValue: string;
  note: string | null;
  addedAt: Date;
}

export async function getViewerWishlist(userId: string): Promise<WishlistCard[]> {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { card: { include: { rarity: true } } },
  });

  return items.map((w) => ({
    id: w.id,
    cardId: w.cardId,
    slug: w.card.slug,
    name: w.card.name,
    number: w.card.number,
    image: cardImage(w.card.imageUrl),
    rarityCode: w.card.rarity.code,
    rarityLabel: w.card.rarity.label,
    quoteValue: formatPrice(w.card.quoteValue),
    note: w.note,
    addedAt: w.createdAt,
  }));
}
