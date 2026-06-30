import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";

// Anti-snipe : une enchère placée dans les dernières minutes prolonge la vente.
const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;
const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000;

/** Mise minimale acceptée : prix de départ pour la 1ʳᵉ enchère, sinon meilleure mise + pas. */
export function minNextBid(startPrice: number, increment: number, topBid: number | null): number {
  return topBid == null ? startPrice : topBid + increment;
}

/** Crée une vente aux enchères sur une variante possédée (réserve l'exemplaire). */
export async function createAuction(
  sellerId: string,
  input: {
    variantId: string;
    startPrice: number;
    durationDays: number;
    reservePrice?: number;
    bidIncrement?: number;
  },
): Promise<string> {
  const item = await prisma.collectionItem.findFirst({
    where: { userId: sellerId, variantId: input.variantId, quantity: { gt: 0 } },
    select: { id: true, quantity: true, reservedQuantity: true, condition: true },
  });
  if (!item) throw new Error("NOT_OWNED");
  if (item.reservedQuantity >= item.quantity) throw new Error("ALL_RESERVED");

  const now = Date.now();
  const endsAt = new Date(now + input.durationDays * 24 * 60 * 60 * 1000);

  const auction = await prisma.$transaction(async (tx) => {
    await tx.collectionItem.update({
      where: { id: item.id },
      data: { reservedQuantity: { increment: 1 }, forSale: true },
    });
    return tx.auction.create({
      data: {
        sellerId,
        variantId: input.variantId,
        condition: item.condition,
        startPrice: input.startPrice,
        reservePrice: input.reservePrice ?? null,
        currentPrice: input.startPrice,
        bidIncrement: input.bidIncrement ?? 0.1,
        status: "ACTIVE",
        startsAt: new Date(now),
        endsAt,
      },
    });
  });

  return auction.id;
}

/** Place une enchère sur une vente aux enchères active. */
export async function placeBid(bidderId: string, auctionId: string, amount: number): Promise<string> {
  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, status: "ACTIVE", endsAt: { gt: new Date() } },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  if (!auction) throw new Error("AUCTION_NOT_FOUND");
  if (auction.sellerId === bidderId) throw new Error("SELF_BID");

  const previousBidder = auction.bids[0]?.bidderId;

  const bid = await prisma.$transaction(async (tx) => {
    // Re-vérifie la meilleure mise DANS la transaction (sécurité concurrence).
    const top = await tx.bid.findFirst({ where: { auctionId }, orderBy: { amount: "desc" } });
    const minBid = minNextBid(Number(auction.startPrice), Number(auction.bidIncrement), top ? Number(top.amount) : null);
    if (amount < minBid) throw new Error("BID_TOO_LOW");

    const created = await tx.bid.create({ data: { auctionId, bidderId, amount } });

    const data: Prisma.AuctionUpdateInput = { currentPrice: amount };
    // Anti-snipe : prolonge la fin si la mise tombe dans la fenêtre finale.
    if (auction.antiSnipe) {
      const remaining = auction.endsAt.getTime() - Date.now();
      if (remaining > 0 && remaining < ANTI_SNIPE_WINDOW_MS) {
        data.endsAt = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS);
      }
    }
    await tx.auction.update({ where: { id: auctionId }, data });
    return created;
  });

  if (previousBidder && previousBidder !== bidderId) {
    await dispatchNotification({
      userId: previousBidder,
      type: "AUCTION_OUTBID",
      actorId: bidderId,
      entityType: "AUCTION",
      entityId: auctionId,
      payload: { amount: formatPrice(amount) },
    });
  }

  await evaluateUserBadgesSafe(bidderId);
  return bid.id;
}

/**
 * Clôture les enchères dont le temps est écoulé : statut SOLD (si réserve atteinte)
 * ou CLOSED, désigne le gagnant, libère la réservation du vendeur et notifie.
 * Idempotent — appelé par le cron de maintenance et paresseusement à la lecture.
 */
export async function settleDueAuctions(): Promise<number> {
  const due = await prisma.auction.findMany({
    where: { status: "ACTIVE", endsAt: { lte: new Date() } },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });

  for (const a of due) {
    const top = a.bids[0];
    const reserveMet = !a.reservePrice || (top != null && Number(top.amount) >= Number(a.reservePrice));
    const sold = top != null && reserveMet;

    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: a.id },
        data: {
          status: sold ? "SOLD" : "CLOSED",
          winnerId: sold ? top.bidderId : null,
          currentPrice: top ? top.amount : a.currentPrice,
        },
      });
      // Libère l'exemplaire réservé du vendeur (réservé à la création de l'enchère).
      await tx.collectionItem.updateMany({
        where: { userId: a.sellerId, variantId: a.variantId, reservedQuantity: { gt: 0 } },
        data: { reservedQuantity: { decrement: 1 }, forSale: false },
      });
    });

    if (sold) {
      await dispatchNotification({
        userId: top.bidderId,
        type: "AUCTION_WON",
        actorId: a.sellerId,
        entityType: "AUCTION",
        entityId: a.id,
        payload: { amount: formatPrice(top.amount) },
      });
    }
    await dispatchNotification({
      userId: a.sellerId,
      type: "AUCTION_ENDED",
      entityType: "AUCTION",
      entityId: a.id,
      payload: { amount: top ? formatPrice(top.amount) : formatPrice(a.startPrice), sold: String(sold) },
    });
  }

  return due.length;
}
