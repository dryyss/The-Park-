import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { evaluateUserBadges } from "@/server/badge/badge.service";

/** Place une enchère sur une vente aux enchères active. */
export async function placeBid(bidderId: string, auctionId: string, amount: number): Promise<string> {
  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, status: "ACTIVE", endsAt: { gt: new Date() } },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });
  if (!auction) throw new Error("AUCTION_NOT_FOUND");
  if (auction.sellerId === bidderId) throw new Error("SELF_BID");

  const currentHigh = auction.bids[0] ? Number(auction.bids[0].amount) : Number(auction.startPrice);
  const minBid = currentHigh + Number(auction.bidIncrement);
  if (amount < minBid) throw new Error("BID_TOO_LOW");

  const bid = await prisma.$transaction(async (tx) => {
    const created = await tx.bid.create({
      data: { auctionId, bidderId, amount },
    });
    await tx.auction.update({
      where: { id: auctionId },
      data: { currentPrice: amount },
    });
    return created;
  });

  const previousBidder = auction.bids[0]?.bidderId;
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

  await evaluateUserBadges(bidderId);
  return bid.id;
}
