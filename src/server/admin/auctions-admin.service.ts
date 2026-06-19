import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuctionStatus, Prisma } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";

export interface AdminAuctionRow {
  id: string;
  cardName: string;
  cardNumber: number;
  sellerName: string;
  status: AuctionStatus;
  currentPrice: string;
  startPrice: string;
  bidCount: number;
  winnerName: string | null;
  startsAt: Date;
  endsAt: Date;
  reportCount: number;
}

export async function listAdminAuctions(input: {
  status?: AuctionStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminAuctionRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));

  const where: Prisma.AuctionWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { seller: { displayName: { contains: q, mode: "insensitive" } } },
      { variant: { card: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      orderBy: { endsAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: { select: { displayName: true } },
        winner: { select: { displayName: true } },
        variant: { include: { card: { select: { name: true, number: true } } } },
        _count: { select: { bids: true } },
      },
    }),
  ]);

  const auctionIds = rows.map((r) => r.id);
  const reportCounts =
    auctionIds.length > 0
      ? await prisma.report.groupBy({
          by: ["targetId"],
          where: { targetType: "AUCTION", targetId: { in: auctionIds } },
          _count: { _all: true },
        })
      : [];
  const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count._all]));

  return {
    total,
    page,
    pageSize,
    rows: rows.map((a) => ({
      id: a.id,
      cardName: a.variant.card.name,
      cardNumber: a.variant.card.number,
      sellerName: a.seller.displayName,
      status: a.status,
      currentPrice: formatPrice(Number(a.currentPrice)),
      startPrice: formatPrice(Number(a.startPrice)),
      bidCount: a._count.bids,
      winnerName: a.winner?.displayName ?? null,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      reportCount: reportMap.get(a.id) ?? 0,
    })),
  };
}

export async function adminCancelAuction(moderatorId: string, auctionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auctionId },
      data: { status: "CANCELLED" },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "AUCTION_CANCELLED",
        targetType: "AUCTION",
        targetId: auctionId,
      },
    });
  });
}

export async function getAuctionsAdminStats() {
  const [active, scheduled, closed, reported] = await Promise.all([
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.auction.count({ where: { status: "SCHEDULED" } }),
    prisma.auction.count({ where: { status: { in: ["CLOSED", "SOLD"] } } }),
    prisma.report.count({ where: { targetType: "AUCTION", status: { in: ["PENDING", "REVIEWING"] } } }),
  ]);
  return { active, scheduled, closed, reported };
}
