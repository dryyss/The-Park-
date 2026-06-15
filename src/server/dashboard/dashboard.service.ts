import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export interface DashboardStats {
  activeListings: number;
  totalViews: number;
  pendingExchanges: number;
  completedExchanges: number;
  activeAuctions: number;
  estimatedRevenue: string;
  recentListings: {
    id: string;
    cardName: string;
    price: string;
    status: string;
    views: number;
  }[];
}

export async function getSellerDashboard(userId: string): Promise<DashboardStats> {
  const [listings, exchanges, auctions] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { variant: { include: { card: true } } },
    }),
    prisma.exchange.findMany({
      where: { OR: [{ initiatorId: userId }, { recipientId: userId }] },
      select: { status: true },
    }),
    prisma.auction.count({ where: { sellerId: userId, status: "ACTIVE" } }),
  ]);

  const activeListings = listings.filter((l) => l.status === "ACTIVE");
  const totalViews = listings.reduce((s, l) => s + l.viewCount, 0);
  const pendingExchanges = exchanges.filter((e) =>
    ["PROPOSED", "ACCEPTED", "AWAITING_SHIPMENT", "SHIPPED"].includes(e.status),
  ).length;
  const completedExchanges = exchanges.filter((e) => e.status === "COMPLETED").length;
  const revenue = activeListings.reduce((s, l) => s + Number(l.price ?? 0), 0);

  return {
    activeListings: activeListings.length,
    totalViews,
    pendingExchanges,
    completedExchanges,
    activeAuctions: auctions,
    estimatedRevenue: formatPrice(revenue),
    recentListings: listings.map((l) => ({
      id: l.id,
      cardName: l.variant.card.name,
      price: l.price ? formatPrice(l.price) : "—",
      status: l.status,
      views: l.viewCount,
    })),
  };
}
