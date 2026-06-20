import "server-only";
import { prisma } from "@/lib/prisma";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";
import { ACTIVE_SALE_STATUSES } from "@/server/sale/sale.mutations";
import { dispatchNotification } from "@/server/notification/notification.mutations";

export interface MarketplaceCartLine {
  id: string;
  listingId: string;
  name: string;
  slug: string;
  image: string | null;
  conditionCode: string;
  versionLabel: string;
  sellerName: string;
  priceLabel: string;
  priceRaw: number;
}

export interface MarketplaceCartSummary {
  lines: MarketplaceCartLine[];
  itemCount: number;
  subtotal: string;
  subtotalRaw: number;
}

const listingCartInclude = {
  listing: {
    include: {
      seller: { select: { displayName: true } },
      variant: { include: { versionType: true, card: true } },
    },
  },
} as const;

export async function getMarketplaceCartItemCount(userId: string): Promise<number> {
  return prisma.marketplaceCartItem.count({ where: { userId } });
}

export async function getMarketplaceCartListingIds(userId: string): Promise<string[]> {
  const items = await prisma.marketplaceCartItem.findMany({
    where: { userId },
    select: { listingId: true },
  });
  return items.map((item) => item.listingId);
}

export async function getViewerMarketplaceCart(userId: string): Promise<MarketplaceCartSummary> {
  const items = await prisma.marketplaceCartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: listingCartInclude,
  });

  let subtotalRaw = 0;
  const lines: MarketplaceCartLine[] = [];

  for (const item of items) {
    const listing = item.listing;
    const card = listing.variant.card;
    const priceRaw = Number(listing.price ?? 0);
    subtotalRaw += priceRaw;
    lines.push({
      id: item.id,
      listingId: listing.id,
      name: card.name,
      slug: card.slug,
      image: cardImage(listing.variant.imageUrl ?? card.imageUrl),
      conditionCode: listing.condition,
      versionLabel: listing.variant.versionType.label,
      sellerName: listing.seller.displayName,
      priceLabel: formatPrice(listing.price),
      priceRaw,
    });
  }

  return {
    lines,
    itemCount: lines.length,
    subtotal: formatPrice(subtotalRaw),
    subtotalRaw,
  };
}

/** Réserve une annonce dans le panier marketplace de l'acheteur. */
export async function addListingToMarketplaceCart(userId: string, listingId: string): Promise<void> {
  const existingOwn = await prisma.marketplaceCartItem.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  if (existingOwn) return;

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "ACTIVE", type: { in: ["SELL", "SELL_OR_TRADE"] } },
    select: {
      id: true,
      sellerId: true,
      price: true,
      variant: { select: { card: { select: { name: true } } } },
    },
  });
  if (!listing) throw new Error("LISTING_UNAVAILABLE");
  if (listing.price == null) throw new Error("NO_PRICE");
  if (listing.sellerId === userId) throw new Error("SELF_PURCHASE");

  const activeSale = await prisma.sale.findFirst({
    where: { listingId, status: { in: [...ACTIVE_SALE_STATUSES] } },
    select: { id: true },
  });
  if (activeSale) throw new Error("ALREADY_SOLD");

  const reservedByOther = await prisma.marketplaceCartItem.findUnique({
    where: { listingId },
    select: { userId: true },
  });
  if (reservedByOther && reservedByOther.userId !== userId) {
    throw new Error("IN_OTHER_CART");
  }

  await prisma.marketplaceCartItem.create({
    data: { userId, listingId },
  });

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  await dispatchNotification({
    userId: listing.sellerId,
    type: "LISTING_IN_CART",
    actorId: userId,
    entityType: "LISTING",
    entityId: listingId,
    payload: {
      buyer: buyer?.displayName ?? "Un membre",
      card: listing.variant.card.name,
    },
  });
}

export async function removeMarketplaceCartItem(userId: string, itemId: string): Promise<void> {
  await prisma.marketplaceCartItem.deleteMany({
    where: { id: itemId, userId },
  });
}

export async function removeMarketplaceCartItemByListing(userId: string, listingId: string): Promise<void> {
  await prisma.marketplaceCartItem.deleteMany({
    where: { userId, listingId },
  });
}

/** Filtre Prisma : annonces non réservées dans un panier. */
export const LISTING_NOT_IN_CART: { marketplaceCartItems: { none: Record<string, never> } } = {
  marketplaceCartItems: { none: {} },
};
