import "server-only";
import { prisma } from "@/lib/prisma";
import type { ExchangeStatus, Prisma, SaleStatus, ShipmentStatus } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";

export interface AdminSaleRow {
  id: string;
  cardName: string;
  buyerName: string;
  sellerName: string;
  status: SaleStatus;
  price: string;
  secured: boolean;
  createdAt: Date;
}

export interface AdminExchangeRow {
  id: string;
  initiatorName: string;
  recipientName: string;
  status: ExchangeStatus;
  secured: boolean;
  itemCount: number;
  createdAt: Date;
}

export interface AdminShipmentRow {
  id: string;
  type: string;
  status: ShipmentStatus;
  secured: boolean;
  trackingNumber: string | null;
  notShipDeadline: Date | null;
  guaranteeEndsAt: Date | null;
  createdAt: Date;
}

export async function listAdminSales(input: {
  status?: SaleStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminSaleRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));
  const where: Prisma.SaleWhereInput = input.status ? { status: input.status } : {};

  const [total, rows] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        buyer: { select: { displayName: true } },
        seller: { select: { displayName: true } },
        listing: { include: { variant: { include: { card: { select: { name: true } } } } } },
        shipment: { select: { secured: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    rows: rows.map((s) => ({
      id: s.id,
      cardName: s.listing.variant.card.name,
      buyerName: s.buyer.displayName,
      sellerName: s.seller.displayName,
      status: s.status,
      price: formatPrice(Number(s.price)),
      secured: s.shipment?.secured ?? false,
      createdAt: s.createdAt,
    })),
  };
}

export async function listAdminExchanges(input: {
  status?: ExchangeStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminExchangeRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));
  const where: Prisma.ExchangeWhereInput = input.status ? { status: input.status } : {};

  const [total, rows] = await Promise.all([
    prisma.exchange.count({ where }),
    prisma.exchange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        initiator: { select: { displayName: true } },
        recipient: { select: { displayName: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    rows: rows.map((e) => ({
      id: e.id,
      initiatorName: e.initiator.displayName,
      recipientName: e.recipient.displayName,
      status: e.status,
      secured: e.secured,
      itemCount: e._count.items,
      createdAt: e.createdAt,
    })),
  };
}

export async function listAdminShipments(input: {
  urgentOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminShipmentRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const where: Prisma.ShipmentWhereInput = input.urgentOnly
    ? { status: "PENDING", notShipDeadline: { lte: soon, gte: now } }
    : {};

  const [total, rows] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      orderBy: [{ notShipDeadline: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    rows: rows.map((s) => ({
      id: s.id,
      type: s.type,
      status: s.status,
      secured: s.secured,
      trackingNumber: s.trackingNumber,
      notShipDeadline: s.notShipDeadline,
      guaranteeEndsAt: s.guaranteeEndsAt,
      createdAt: s.createdAt,
    })),
  };
}

export async function getTransactionsAdminStats() {
  const activeSaleStatuses: SaleStatus[] = [
    "PAID",
    "AWAITING_SHIPMENT",
    "SHIPPED",
    "DELIVERED_WINDOW",
    "DELIVERED",
    "DISPUTED",
  ];
  const activeExchangeStatuses: ExchangeStatus[] = [
    "ACCEPTED",
    "AWAITING_SHIPMENT",
    "SHIPPED",
    "DELIVERED_WINDOW",
    "DELIVERED",
    "GUARANTEE_SUSPENDED",
    "DISPUTED",
  ];

  const [activeSales, activeExchanges, disputedSales, disputedExchanges, pendingShipments] = await Promise.all([
    prisma.sale.count({ where: { status: { in: activeSaleStatuses } } }),
    prisma.exchange.count({ where: { status: { in: activeExchangeStatuses } } }),
    prisma.sale.count({ where: { status: "DISPUTED" } }),
    prisma.exchange.count({ where: { status: "DISPUTED" } }),
    prisma.shipment.count({ where: { status: "PENDING" } }),
  ]);

  return { activeSales, activeExchanges, disputedSales, disputedExchanges, pendingShipments };
}
