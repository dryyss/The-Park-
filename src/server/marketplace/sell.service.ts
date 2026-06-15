import "server-only";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage } from "@/lib/rarity";

export interface OwnedCardForSale {
  variantId: string;
  slug: string;
  name: string;
  shortName: string;
  image: string | null;
  number: number;
  glyph: string;
  color: string;
  quoteValue: string;
  condition: string;
  versionLabel: string;
}

/** Cartes réellement possédées — seules candidates à une annonce marketplace. */
export async function getOwnedCardsForSale(userId: string): Promise<OwnedCardForSale[]> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: {
      variant: {
        include: {
          card: { include: { rarity: true } },
          versionType: true,
        },
      },
    },
    orderBy: { variant: { card: { number: "asc" } } },
  });

  return items.map((item) => {
    const card = item.variant.card;
    const meta = rarityMeta(card.rarity?.code ?? "c");
    return {
      variantId: item.variantId,
      slug: card.slug,
      name: card.name,
      shortName: card.name.length > 14 ? `${card.name.slice(0, 12)}…` : card.name,
      image: cardImage(card.imageUrl),
      number: card.number,
      glyph: meta.glyph,
      color: meta.color,
      quoteValue: Number(card.quoteValue).toFixed(2).replace(".", ","),
      condition: item.condition,
      versionLabel: item.variant.versionType.label,
    };
  });
}
