import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import type { OrderStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: string;
  customerName: string;
  customerId: string;
  itemCount: number;
  createdAt: Date;
  trackingNumber: string | null;
  paymentStatus: PaymentStatus | null;
}

export interface AdminOrderListResult {
  rows: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrderStats {
  total: number;
  toShip: number;
  todayCount: number;
  revenueToday: string;
  revenueMonth: string;
}

export interface AdminOrderLine {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: string;
  shippingCost: string;
  total: string;
  itemCount: number;
  createdAt: Date;
  shippedAt: Date | null;
  updatedAt: Date;
  customerId: string;
  customerName: string;
  customerEmail: string;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingZip: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  shippingMethod: string | null;
  trackingNumber: string | null;
  payment: {
    status: PaymentStatus;
    amount: string;
    stripePaymentIntentId: string | null;
    capturedAt: Date | null;
  } | null;
  lines: AdminOrderLine[];
}

export interface ListAdminOrdersParams {
  q?: string;
  status?: OrderStatus;
  period?: "today" | "week" | "month";
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE = 25;

function periodWhere(period?: ListAdminOrdersParams["period"]): Prisma.OrderWhereInput | undefined {
  if (!period) return undefined;
  const now = new Date();
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { createdAt: { gte: start } };
}

function buildWhere(params: ListAdminOrdersParams): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (params.status) where.status = params.status;
  const period = periodWhere(params.period);
  if (period) Object.assign(where, period);
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { user: { displayName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { trackingNumber: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

function mapOrderRow(
  o: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: { toString(): string };
    trackingNumber: string | null;
    createdAt: Date;
    user: { id: string; displayName: string };
    payment: { status: PaymentStatus } | null;
    _count: { items: number };
  },
): AdminOrderRow {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: formatPrice(o.total),
    customerName: o.user.displayName,
    customerId: o.user.id,
    itemCount: o._count.items,
    createdAt: o.createdAt,
    trackingNumber: o.trackingNumber,
    paymentStatus: o.payment?.status ?? null,
  };
}

export async function listAdminOrders(params: ListAdminOrdersParams = {}): Promise<AdminOrderListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const where = buildWhere(params);

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, displayName: true } },
        payment: { select: { status: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { rows: rows.map(mapOrderRow), total, page, pageSize };
}

export async function getAdminOrderStats(): Promise<AdminOrderStats> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const paidStatuses: OrderStatus[] = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"];

  const [total, toShip, todayCount, todayRevenue, monthRevenue] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart }, status: { in: paidStatuses } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: monthStart }, status: { in: paidStatuses } },
      _sum: { total: true },
    }),
  ]);

  return {
    total,
    toShip,
    todayCount,
    revenueToday: formatPrice(todayRevenue._sum.total ?? 0),
    revenueMonth: formatPrice(monthRevenue._sum.total ?? 0),
  };
}

export async function getAdminOrderById(orderId: string): Promise<AdminOrderDetail | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      items: { include: { product: { select: { name: true, sku: true } } } },
      payment: true,
      _count: { select: { items: true } },
    },
  });
  if (!o) return null;

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    subtotal: formatPrice(o.subtotal),
    shippingCost: formatPrice(o.shippingCost),
    total: formatPrice(o.total),
    itemCount: o._count.items,
    createdAt: o.createdAt,
    shippedAt: o.shippedAt,
    updatedAt: o.updatedAt,
    customerId: o.user.id,
    customerName: o.user.displayName,
    customerEmail: o.user.email,
    shippingName: o.shippingName,
    shippingLine1: o.shippingLine1,
    shippingZip: o.shippingZip,
    shippingCity: o.shippingCity,
    shippingCountry: o.shippingCountry,
    shippingMethod: o.shippingMethod,
    trackingNumber: o.trackingNumber,
    payment: o.payment
      ? {
          status: o.payment.status,
          amount: formatPrice(o.payment.amount),
          stripePaymentIntentId: o.payment.stripePaymentIntentId,
          capturedAt: o.payment.capturedAt,
        }
      : null,
    lines: o.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      productSku: item.product.sku,
      quantity: item.quantity,
      unitPrice: formatPrice(item.unitPrice),
      lineTotal: formatPrice(Number(item.unitPrice) * item.quantity),
    })),
  };
}
