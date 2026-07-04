import "server-only";
import { prisma } from "@/lib/prisma";
import type { CardCondition, ListingType } from "@/generated/prisma/client";
import { getPlatformConfig } from "@/server/platform/platform.service";
import { notifyWishlistForNewListing } from "@/server/marketplace/wishlist-listing-notify";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";

/** Publie une annonce marketplace — uniquement sur une variante (et un état) possédé. */
export async function publishListing(
  sellerId: string,
  input: {
    variantId: string;
    type: ListingType;
    condition?: CardCondition;
    price?: number;
    description?: string;
  },
): Promise<string> {
  const item = await prisma.collectionItem.findFirst({
    where: {
      userId: sellerId,
      variantId: input.variantId,
      quantity: { gt: 0 },
      ...(input.condition ? { condition: input.condition } : {}),
    },
    select: { id: true, quantity: true, reservedQuantity: true, condition: true },
  });
  if (!item) throw new Error("NOT_OWNED");
  if (item.reservedQuantity >= item.quantity) throw new Error("ALL_RESERVED");

  // Le prix n'a de sens que pour une vente ; un échange pur n'en porte pas.
  const sells = input.type !== "TRADE";
  const trades = input.type !== "SELL";

  const { listingDefaultDays } = await getPlatformConfig();
  const expiresAt = new Date(Date.now() + listingDefaultDays * 24 * 60 * 60 * 1000);

  const listing = await prisma.$transaction(async (tx) => {
    await tx.collectionItem.update({
      where: { id: item.id },
      data: { reservedQuantity: { increment: 1 }, forSale: sells, forTrade: trades },
    });

    return tx.listing.create({
      data: {
        sellerId,
        variantId: input.variantId,
        type: input.type,
        status: "ACTIVE",
        price: sells ? (input.price ?? null) : null,
        condition: item.condition,
        quantity: 1,
        description: input.description ?? null,
        expiresAt,
      },
    });
  });

  await notifyWishlistForNewListing(listing.id, sellerId).catch((err) => {
    console.error("[marketplace] wishlist notify failed", err);
  });

  await evaluateUserBadgesSafe(sellerId);
  return listing.id;
}

/** Met une annonce en pause. */
export async function pauseListing(sellerId: string, listingId: string): Promise<void> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, sellerId, status: "ACTIVE" },
  });
  if (!listing) throw new Error("NOT_FOUND");
  await prisma.listing.update({ where: { id: listingId }, data: { status: "PAUSED" } });
}

/** Réactive une annonce en pause. */
export async function resumeListing(sellerId: string, listingId: string): Promise<void> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, sellerId, status: "PAUSED" },
  });
  if (!listing) throw new Error("NOT_FOUND");
  await prisma.listing.update({ where: { id: listingId }, data: { status: "ACTIVE" } });
}

/** Annule une annonce et libère la réservation de l'état concerné. */
export async function cancelListing(sellerId: string, listingId: string): Promise<void> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, sellerId, status: { in: ["ACTIVE", "PAUSED", "DRAFT"] } },
  });
  if (!listing) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: listingId }, data: { status: "CANCELLED" } });
    // Cible l'état précis de l'annonce (plusieurs états possibles par variante).
    await tx.collectionItem.updateMany({
      where: {
        userId: sellerId,
        variantId: listing.variantId,
        condition: listing.condition,
        reservedQuantity: { gt: 0 },
      },
      data: { reservedQuantity: { decrement: 1 } },
    });
  });
}

/** Expire les annonces dépassant expiresAt (job cron). */
export async function expireDueListings(): Promise<number> {
  const due = await prisma.listing.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    select: { id: true, sellerId: true, variantId: true },
  });

  for (const l of due) {
    await prisma.$transaction(async (tx) => {
      await tx.listing.update({ where: { id: l.id }, data: { status: "EXPIRED" } });
      await tx.collectionItem.updateMany({
        where: { userId: l.sellerId, variantId: l.variantId },
        data: { reservedQuantity: { decrement: 1 }, forSale: false },
      });
    });
  }
  return due.length;
}

/** Publie une annonce « je recherche ». */
export async function publishWantListing(
  sellerId: string,
  input: { variantId: string; budgetMax?: number; minCondition?: import("@/generated/prisma/client").CardCondition },
): Promise<string> {
  const listing = await prisma.listing.create({
    data: {
      sellerId,
      variantId: input.variantId,
      type: "WANT",
      status: "ACTIVE",
      budgetMax: input.budgetMax ?? null,
      minCondition: input.minCondition ?? null,
    },
  });
  await evaluateUserBadgesSafe(sellerId);
  return listing.id;
}
