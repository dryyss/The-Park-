import "server-only";
import { prisma } from "@/lib/prisma";

export async function getSaleConversationId(saleId: string): Promise<string | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { saleId },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

/** Vente + suivi complet pour l'écran de suivi (acheteur OU vendeur). */
export async function getSaleTrackingForViewer(saleId: string, viewerId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, OR: [{ buyerId: viewerId }, { sellerId: viewerId }] },
    include: {
      listing: {
        include: {
          variant: { include: { card: { include: { rarity: true } }, versionType: true } },
        },
      },
      buyer: { select: { id: true, displayName: true, slug: true } },
      seller: { select: { id: true, displayName: true, slug: true } },
      shipment: {
        include: { proofs: { orderBy: { serverRecordedAt: "asc" } } },
      },
      conversation: { select: { id: true } },
      disputes: { select: { id: true, status: true }, orderBy: { openedAt: "desc" }, take: 1 },
    },
  });
  if (!sale) return null;
  return { sale, isBuyer: sale.buyerId === viewerId, isSeller: sale.sellerId === viewerId };
}

/** Ventes du vendeur pour le dashboard « Mes ventes ». */
export async function getSellerSales(sellerId: string, limit = 50) {
  return prisma.sale.findMany({
    where: { sellerId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      listing: {
        include: {
          variant: { include: { card: { select: { name: true, imageUrl: true } }, versionType: true } },
        },
      },
      buyer: { select: { displayName: true, slug: true } },
      shipment: { select: { id: true, status: true, trackingNumber: true, notShipDeadline: true } },
    },
  });
}

/** Achats de l'acheteur pour « Mes achats ». */
export async function getBuyerSales(buyerId: string, limit = 50) {
  return prisma.sale.findMany({
    where: { buyerId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      listing: {
        include: {
          variant: { include: { card: { select: { name: true, imageUrl: true } }, versionType: true } },
        },
      },
      seller: { select: { displayName: true, slug: true } },
      shipment: { select: { id: true, status: true, trackingNumber: true, guaranteeEndsAt: true } },
    },
  });
}

export async function getSaleForBuyer(saleId: string, buyerId: string) {
  return prisma.sale.findFirst({
    where: { id: saleId, buyerId },
    include: {
      listing: {
        include: {
          variant: { include: { card: { include: { rarity: true } }, versionType: true } },
        },
      },
      conversation: { select: { id: true } },
    },
  });
}
