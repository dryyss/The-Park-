import "server-only";
import { prisma } from "@/lib/prisma";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";
import type { AuctionStatus } from "@/generated/prisma/client";

export interface AuctionBid {
  id: string;
  bidderName: string;
  bidderInitial: string;
  amount: string;
  isAuto: boolean;
  createdAt: Date;
}

export interface AuctionListItem {
  id: string;
  cardName: string;
  cardNumber: number;
  cardSlug: string;
  image: string | null;
  rarityCode: string;
  condition: string;
  sellerName: string;
  sellerSlug: string;
  currentPrice: string;
  startPrice: string;
  bidCount: number;
  status: AuctionStatus;
  endsAt: Date;
  antiSnipe: boolean;
}

export interface AuctionDetail extends AuctionListItem {
  reservePrice: string | null;
  bidIncrement: string;
  minBidAmount: number;
  bids: AuctionBid[];
  winnerName: string | null;
}

function mapAuction(
  a: Awaited<ReturnType<typeof fetchAuctions>>[number],
  bidCount: number,
): AuctionListItem {
  const card = a.variant.card;
  return {
    id: a.id,
    cardName: card.name,
    cardNumber: card.number,
    cardSlug: card.slug,
    image: cardImage(card.imageUrl),
    rarityCode: card.rarity.code,
    condition: a.condition,
    sellerName: a.seller.displayName,
    sellerSlug: a.seller.slug,
    currentPrice: formatPrice(a.currentPrice),
    startPrice: formatPrice(a.startPrice),
    bidCount,
    status: a.status,
    endsAt: a.endsAt,
    antiSnipe: a.antiSnipe,
  };
}

async function fetchAuctions() {
  return prisma.auction.findMany({
    where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
    orderBy: { endsAt: "asc" },
    include: {
      seller: { select: { displayName: true, slug: true } },
      variant: { include: { card: { include: { rarity: true } }, versionType: true } },
      _count: { select: { bids: true } },
    },
  });
}

export async function getActiveAuctions(): Promise<AuctionListItem[]> {
  const rows = await fetchAuctions();
  return rows.map((a) => mapAuction(a, a._count.bids));
}

export async function getAuctionById(id: string): Promise<AuctionDetail | null> {
  const a = await prisma.auction.findUnique({
    where: { id },
    include: {
      seller: { select: { displayName: true, slug: true } },
      winner: { select: { displayName: true } },
      variant: { include: { card: { include: { rarity: true } }, versionType: true } },
      bids: {
        orderBy: { amount: "desc" },
        take: 20,
        include: { bidder: { select: { displayName: true } } },
      },
      _count: { select: { bids: true } },
    },
  });
  if (!a) return null;

  const base = mapAuction(a, a._count.bids);
  const currentHigh = a.bids[0] ? Number(a.bids[0].amount) : Number(a.startPrice);
  const minBidAmount = currentHigh + Number(a.bidIncrement);
  return {
    ...base,
    reservePrice: a.reservePrice ? formatPrice(a.reservePrice) : null,
    bidIncrement: formatPrice(a.bidIncrement),
    minBidAmount,
    winnerName: a.winner?.displayName ?? null,
    bids: a.bids.map((b) => ({
      id: b.id,
      bidderName: b.bidder.displayName,
      bidderInitial: b.bidder.displayName.charAt(0).toUpperCase(),
      amount: formatPrice(b.amount),
      isAuto: b.isAuto,
      createdAt: b.createdAt,
    })),
  };
}
