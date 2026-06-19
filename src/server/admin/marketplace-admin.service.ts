import "server-only";
import { prisma } from "@/lib/prisma";
import type { ListingStatus, ListingType, Prisma } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";

export interface AdminListingRow {
  id: string;
  cardName: string;
  cardNumber: number;
  sellerName: string;
  sellerId: string;
  type: ListingType;
  status: ListingStatus;
  price: string | null;
  condition: string;
  viewCount: number;
  reportCount: number;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface AdminListingListResult {
  rows: AdminListingRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAdminListings(input: {
  q?: string;
  status?: ListingStatus;
  type?: ListingType;
  page?: number;
  pageSize?: number;
}): Promise<AdminListingListResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ListingWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.type) where.type = input.type;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { seller: { displayName: { contains: q, mode: "insensitive" } } },
      { seller: { email: { contains: q, mode: "insensitive" } } },
      { variant: { card: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        seller: { select: { id: true, displayName: true } },
        variant: { select: { card: { select: { name: true, number: true } } } },
      },
    }),
  ]);

  const listingIds = rows.map((r) => r.id);
  const reportCounts =
    listingIds.length > 0
      ? await prisma.report.groupBy({
          by: ["targetId"],
          where: { targetType: "LISTING", targetId: { in: listingIds } },
          _count: { _all: true },
        })
      : [];
  const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count._all]));

  return {
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      cardName: r.variant.card.name,
      cardNumber: r.variant.card.number,
      sellerName: r.seller.displayName,
      sellerId: r.seller.id,
      type: r.type,
      status: r.status,
      price: r.price != null ? formatPrice(Number(r.price)) : null,
      condition: r.condition,
      viewCount: r.viewCount,
      reportCount: reportMap.get(r.id) ?? 0,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    })),
  };
}

export async function adminModerateListing(
  moderatorId: string,
  listingId: string,
  action: "PAUSE" | "CANCEL" | "ACTIVATE",
): Promise<void> {
  const statusMap = { PAUSE: "PAUSED", CANCEL: "CANCELLED", ACTIVATE: "ACTIVE" } as const;
  await prisma.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id: listingId },
      data: { status: statusMap[action] },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "LISTING_MODERATED",
        targetType: "LISTING",
        targetId: listingId,
        details: { action },
      },
    });
  });
}

export async function getMarketplaceAdminStats() {
  const [active, paused, want, reported] = await Promise.all([
    prisma.listing.count({ where: { status: "ACTIVE", type: { not: "WANT" } } }),
    prisma.listing.count({ where: { status: "PAUSED" } }),
    prisma.listing.count({ where: { status: "ACTIVE", type: "WANT" } }),
    prisma.report.count({ where: { targetType: "LISTING", status: { in: ["PENDING", "REVIEWING"] } } }),
  ]);
  return { active, paused, want, reported };
}
