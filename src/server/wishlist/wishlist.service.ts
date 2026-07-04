import "server-only";
import { prisma } from "@/lib/prisma";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";
import { wishlistEditionDisplayLabel, wishlistIsFirstEdition } from "@/server/wishlist/wishlist.mutations";

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
  seasonCode: string;
  seasonName: string;
  versionLabel: string;
  conditionCode: string;
  editionLabel: string | null;
  isFirstEdition: boolean;
  note: string | null;
  /** Seuil d'alerte prix (€) ou null si simple alerte de disponibilité. */
  alertPrice: number | null;
  addedAt: Date;
}

export async function getViewerWishlist(userId: string): Promise<WishlistCard[]> {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      card: { include: { rarity: true } },
      variant: { include: { versionType: true } },
      season: true,
    },
  });

  return items.map((w) => ({
    id: w.id,
    cardId: w.cardId,
    slug: w.card.slug,
    name: w.card.name,
    number: w.card.number,
    image: cardImage(w.variant.imageUrl ?? w.card.imageUrl),
    rarityCode: w.card.rarity.code,
    rarityLabel: w.card.rarity.label,
    quoteValue: formatPrice(w.card.quoteValue),
    seasonCode: w.season.code,
    seasonName: w.season.name,
    versionLabel: w.variant.versionType.label,
    conditionCode: w.condition,
    editionLabel: wishlistEditionDisplayLabel(w.editionPreset, w.variant.editionLabel),
    isFirstEdition: wishlistIsFirstEdition(w.editionPreset, w.variant.editionLabel),
    note: w.note,
    alertPrice: w.alertPrice == null ? null : Number(w.alertPrice.toString()),
    addedAt: w.createdAt,
  }));
}

/** Identifiants de cartes déjà présentes dans la wishlist du membre. */
export async function getViewerWishlistCardIds(userId: string): Promise<string[]> {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    select: { cardId: true },
    distinct: ["cardId"],
  });
  return items.map((item) => item.cardId);
}
