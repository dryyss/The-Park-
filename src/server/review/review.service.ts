import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";

export interface ReviewInput {
  authorId: string;
  targetId: string;
  source: "SALE" | "EXCHANGE";
  saleId?: string;
  exchangeId?: string;
  rating: number;
  comment?: string;
}

export async function createReview(input: ReviewInput): Promise<void> {
  if (input.rating < 1 || input.rating > 5) throw new Error("INVALID_RATING");
  if (input.authorId === input.targetId) throw new Error("SELF_REVIEW");

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        authorId: input.authorId,
        targetId: input.targetId,
        source: input.source,
        saleId: input.saleId ?? null,
        exchangeId: input.exchangeId ?? null,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
    });

    const agg = await tx.review.aggregate({
      where: { targetId: input.targetId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.user.update({
      where: { id: input.targetId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        reviewCount: agg._count._all,
      },
    });
  });

  await dispatchNotification({
    userId: input.targetId,
    type: "REVIEW_RECEIVED",
    actorId: input.authorId,
    entityType: "REVIEW",
    entityId: null,
  });
}

export async function hasViewerReviewedExchange(authorId: string, exchangeId: string): Promise<boolean> {
  const existing = await prisma.review.findUnique({
    where: { authorId_exchangeId: { authorId, exchangeId } },
    select: { id: true },
  });
  return !!existing;
}

export async function hasViewerReviewedSale(authorId: string, saleId: string): Promise<boolean> {
  const existing = await prisma.review.findUnique({
    where: { authorId_saleId: { authorId, saleId } },
    select: { id: true },
  });
  return !!existing;
}

export interface PendingSaleReview {
  saleId: string;
  targetId: string;
  targetName: string;
  cardName: string;
  completedAt: Date;
}

export async function getSalesPendingReview(viewerId: string): Promise<PendingSaleReview[]> {
  const [purchases, sales] = await Promise.all([
    prisma.sale.findMany({
      where: {
        buyerId: viewerId,
        status: { in: ["DELIVERED", "COMPLETED"] },
        reviews: { none: { authorId: viewerId } },
      },
      select: {
        id: true,
        updatedAt: true,
        seller: { select: { id: true, displayName: true } },
        listing: { select: { variant: { select: { card: { select: { name: true } } } } } },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sale.findMany({
      where: {
        sellerId: viewerId,
        status: { in: ["DELIVERED", "COMPLETED"] },
        reviews: { none: { authorId: viewerId } },
      },
      select: {
        id: true,
        updatedAt: true,
        buyer: { select: { id: true, displayName: true } },
        listing: { select: { variant: { select: { card: { select: { name: true } } } } } },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const result: PendingSaleReview[] = [
    ...purchases.map((p) => ({
      saleId: p.id,
      targetId: p.seller.id,
      targetName: p.seller.displayName,
      cardName: p.listing.variant.card.name,
      completedAt: p.updatedAt,
    })),
    ...sales.map((s) => ({
      saleId: s.id,
      targetId: s.buyer.id,
      targetName: s.buyer.displayName,
      cardName: s.listing.variant.card.name,
      completedAt: s.updatedAt,
    })),
  ];

  return result.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}
