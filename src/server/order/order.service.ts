import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import type { OrderStatus } from "@/generated/prisma/client";

export interface OrderLine {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: string;
  itemCount: number;
  createdAt: Date;
}

export interface OrderDetail extends OrderListItem {
  subtotal: string;
  shippingCost: string;
  shippingName: string | null;
  shippingCity: string | null;
  trackingNumber: string | null;
  lines: OrderLine[];
}

export async function getViewerOrders(userId: string): Promise<OrderListItem[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: formatPrice(o.total),
    itemCount: o._count.items,
    createdAt: o.createdAt,
  }));
}

export async function getOrderById(orderId: string, userId: string): Promise<OrderDetail | null> {
  const o = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { include: { product: true } },
      _count: { select: { items: true } },
    },
  });
  if (!o) return null;

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: formatPrice(o.total),
    itemCount: o._count.items,
    createdAt: o.createdAt,
    subtotal: formatPrice(o.subtotal),
    shippingCost: formatPrice(o.shippingCost),
    shippingName: o.shippingName,
    shippingCity: o.shippingCity,
    trackingNumber: o.trackingNumber,
    lines: o.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: formatPrice(item.unitPrice),
      lineTotal: formatPrice(Number(item.unitPrice) * item.quantity),
    })),
  };
}
