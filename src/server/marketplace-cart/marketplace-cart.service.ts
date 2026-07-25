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
  shippingMode: import("@/generated/prisma/client").ShippingMode;
  /** Fin de la réservation, en ISO — permet d'afficher un compte à rebours. */
  expiresAt: string;
  /** Réservation échue : la ligne reste visible mais n'est pas payable en l'état. */
  expired: boolean;
}

export interface MarketplaceCartSummary {
  lines: MarketplaceCartLine[];
  itemCount: number;
  /** Lignes encore réservées (celles qui composent le sous-total). */
  activeCount: number;
  /** Lignes dont la réservation a expiré et qu'il faut renouveler. */
  expiredCount: number;
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


// Le panier affiche désormais TOUTES ses lignes, expirées comprises. Les filtrer
// sur `expiresAt` les faisait disparaître sans le moindre message : sur un gros
// lot, les premières cartes ajoutées s'évaporaient avant d'arriver au paiement.
export async function getMarketplaceCartItemCount(userId: string): Promise<number> {
  return prisma.marketplaceCartItem.count({ where: { userId } });
}

/**
 * Annonces encore activement réservées par l'acheteur (pastille « dans ton panier »
 * du marketplace). Volontairement limité aux réservations valides : une annonce
 * expirée redevient proposée à l'ajout, et `addListingToMarketplaceCart` reconduit
 * alors la ligne existante au lieu d'en créer une seconde.
 */
export async function getMarketplaceCartListingIds(userId: string): Promise<string[]> {
  const items = await prisma.marketplaceCartItem.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
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

  const now = Date.now();
  let subtotalRaw = 0;
  let expiredCount = 0;
  const lines: MarketplaceCartLine[] = [];

  for (const item of items) {
    const listing = item.listing;
    const card = listing.variant.card;
    const priceRaw = Number(listing.price ?? 0);
    const expired = item.expiresAt.getTime() <= now;
    // Le sous-total ne compte que ce qui est réellement payable.
    if (expired) expiredCount += 1;
    else subtotalRaw += priceRaw;
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
      expiresAt: item.expiresAt.toISOString(),
      expired,
    });
  }

  return {
    lines,
    itemCount: lines.length,
    activeCount: lines.length - expiredCount,
    expiredCount,
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

/**
 * Repousse l'échéance de toutes les réservations encore valides de l'acheteur.
 *
 * La réservation est ainsi glissante : elle court à partir de la dernière action
 * sur le panier, et non de l'ajout de chaque ligne. Sans cela, constituer un gros
 * lot pendant plus de 30 minutes faisait expirer les premières cartes avant même
 * d'avoir fini de remplir le panier.
 */
export async function renewMarketplaceCartReservations(userId: string): Promise<void> {
  await prisma.marketplaceCartItem.updateMany({
    where: { userId, expiresAt: { gt: new Date() } },
    data: { expiresAt: cartExpiresAt() },
  });
}

export interface CartRenewalResult {
  /** Lignes dont la réservation a bien été relancée. */
  renewed: number;
  /** Lignes retirées car l'annonce n'est plus disponible entre-temps. */
  dropped: number;
}

/**
 * Relance les réservations expirées encore rattachées à l'acheteur.
 *
 * Une ligne expirée reste en base tant que la purge quotidienne n'est pas passée
 * et que personne d'autre ne l'a reprise : elle est donc récupérable, à condition
 * que l'annonce soit toujours en vente. Les autres sont retirées du panier.
 */
export async function renewExpiredMarketplaceCartItems(userId: string): Promise<CartRenewalResult> {
  const now = new Date();
  const expired = await prisma.marketplaceCartItem.findMany({
    where: { userId, expiresAt: { lte: now } },
    select: { id: true, listingId: true },
  });
  if (expired.length === 0) return { renewed: 0, dropped: 0 };

  const listingIds = expired.map((item) => item.listingId);
  const [availableListings, activeSales] = await Promise.all([
    prisma.listing.findMany({
      where: { id: { in: listingIds }, status: "ACTIVE", type: { in: ["SELL", "SELL_OR_TRADE"] } },
      select: { id: true },
    }),
    prisma.sale.findMany({
      where: { listingId: { in: listingIds }, status: { in: [...ACTIVE_SALE_STATUSES] } },
      select: { listingId: true },
    }),
  ]);
  const soldListingIds = new Set(activeSales.map((sale) => sale.listingId));
  const availableIds = new Set(
    availableListings.map((listing) => listing.id).filter((id) => !soldListingIds.has(id)),
  );

  const renewable = expired.filter((item) => availableIds.has(item.listingId));
  const stale = expired.filter((item) => !availableIds.has(item.listingId));

  if (renewable.length > 0) {
    await prisma.marketplaceCartItem.updateMany({
      where: { id: { in: renewable.map((item) => item.id) } },
      data: { expiresAt: cartExpiresAt() },
    });
  }
  if (stale.length > 0) {
    await prisma.marketplaceCartItem.deleteMany({
      where: { id: { in: stale.map((item) => item.id) } },
    });
  }

  return { renewed: renewable.length, dropped: stale.length };
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
    // Déjà dans son panier : on repousse l'échéance de tout le panier.
    await renewMarketplaceCartReservations(userId);
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
  // Fenêtre glissante : l'ajout d'une carte prolonge tout le lot en cours.
  await renewMarketplaceCartReservations(userId);

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
