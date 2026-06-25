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
  shippingMode: "STANDARD" | "SECURED";
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
  return prisma.marketplaceCartItem.count({ where: { userId, expiresAt: { gt: new Date() } } });
}

export async function getMarketplaceCartListingIds(userId: string): Promise<string[]> {
  const items = await prisma.marketplaceCartItem.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { listingId: true },
  });
  return items.map((item) => item.listingId);
}

export async function getViewerMarketplaceCart(userId: string): Promise<MarketplaceCartSummary> {
  const items = await prisma.marketplaceCartItem.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
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
      shippingMode: listing.shippingMode,
    });
  }

  return {
    lines,
    itemCount: lines.length,
    subtotal: formatPrice(subtotalRaw),
    subtotalRaw,
  };
}

const CART_RESERVATION_MINUTES = 30;
const CART_COOLDOWN_MINUTES = 10;

function cartExpiresAt(): Date {
  return new Date(Date.now() + CART_RESERVATION_MINUTES * 60 * 1000);
}

function cooldownUntil(): Date {
  return new Date(Date.now() + CART_COOLDOWN_MINUTES * 60 * 1000);
}

/** Réserve une annonce dans le panier marketplace de l'acheteur. */
export async function addListingToMarketplaceCart(userId: string, listingId: string): Promise<void> {
  const now = new Date();

  // Vérifie le cooldown 10 min (ne peut pas re-réserver juste après avoir libéré)
  const cooldown = await prisma.marketplaceCartCooldown.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { cooldownUntil: true },
  });
  if (cooldown && cooldown.cooldownUntil > now) throw new Error("CART_COOLDOWN");

  const existingOwn = await prisma.marketplaceCartItem.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true, expiresAt: true },
  });
  if (existingOwn) {
    // Renew expiry if already in own cart
    await prisma.marketplaceCartItem.update({
      where: { userId_listingId: { userId, listingId } },
      data: { expiresAt: cartExpiresAt() },
    });
    return;
  }

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
    select: { userId: true, expiresAt: true },
  });
  // Allow adding if the other buyer's reservation has expired
  if (reservedByOther && reservedByOther.userId !== userId) {
    if (reservedByOther.expiresAt > now) throw new Error("IN_OTHER_CART");
    // Expired — delete it, pose cooldown on previous holder, then take over
    await prisma.$transaction([
      prisma.marketplaceCartItem.delete({ where: { listingId } }),
      prisma.marketplaceCartCooldown.upsert({
        where: { userId_listingId: { userId: reservedByOther.userId, listingId } },
        create: { userId: reservedByOther.userId, listingId, cooldownUntil: cooldownUntil() },
        update: { cooldownUntil: cooldownUntil() },
      }),
    ]);
  }

  await prisma.marketplaceCartItem.create({
    data: { userId, listingId, expiresAt: cartExpiresAt() },
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
  const item = await prisma.marketplaceCartItem.findFirst({
    where: { id: itemId, userId },
    select: { listingId: true },
  });
  if (!item) return;
  await prisma.marketplaceCartItem.delete({ where: { id: itemId } });
  // Pas de cooldown quand l'acheteur retire manuellement — il peut reprendre immédiatement
}

export async function removeMarketplaceCartItemByListing(userId: string, listingId: string): Promise<void> {
  await prisma.marketplaceCartItem.deleteMany({
    where: { userId, listingId },
  });
}

/** Filtre Prisma : annonces sans réservation active (non expirée) dans un panier. */
export function listingNotInActiveCart() {
  return {
    marketplaceCartItems: { none: { expiresAt: { gt: new Date() } } },
  };
}

/** Supprime les entrées panier expirées et pose un cooldown 10 min sur ces acheteurs. */
export async function purgeExpiredCartItems(): Promise<number> {
  const now = new Date();
  const expired = await prisma.marketplaceCartItem.findMany({
    where: { expiresAt: { lte: now } },
    select: { userId: true, listingId: true },
  });
  if (expired.length === 0) return 0;

  await prisma.$transaction([
    prisma.marketplaceCartItem.deleteMany({ where: { expiresAt: { lte: now } } }),
    // Purge les vieux cooldowns expirés
    prisma.marketplaceCartCooldown.deleteMany({ where: { cooldownUntil: { lte: now } } }),
    // Pose le cooldown 10 min pour chaque acheteur dont la réservation a expiré
    ...expired.map((e) =>
      prisma.marketplaceCartCooldown.upsert({
        where: { userId_listingId: { userId: e.userId, listingId: e.listingId } },
        create: { userId: e.userId, listingId: e.listingId, cooldownUntil: cooldownUntil() },
        update: { cooldownUntil: cooldownUntil() },
      }),
    ),
  ]);

  return expired.length;
}
