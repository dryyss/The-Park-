import "server-only";
import { prisma } from "@/lib/prisma";
import type { ProductType } from "@/generated/prisma/client";

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  customerName: string;
  itemCount: number;
  createdAt: Date;
}

export interface AdminSeasonRow {
  id: string;
  code: string;
  name: string;
  cardCount: number;
  releaseDate: Date | null;
}

export interface AdminCardRow {
  id: string;
  number: number;
  name: string;
  slug: string;
  rarityLabel: string;
  quoteValue: string;
}

export async function getAdminOrders(): Promise<AdminOrderRow[]> {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { displayName: true } },
      _count: { select: { items: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(o.total)),
    customerName: o.user.displayName,
    itemCount: o._count.items,
    createdAt: o.createdAt,
  }));
}

export async function getAdminSeasons(): Promise<AdminSeasonRow[]> {
  const seasons = await prisma.season.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { cards: true } } },
  });
  return seasons.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    cardCount: s._count.cards,
    releaseDate: s.releaseDate,
  }));
}

export async function getAdminSeasonCards(seasonId: string): Promise<AdminCardRow[]> {
  const cards = await prisma.card.findMany({
    where: { seasonId },
    orderBy: { number: "asc" },
    include: { rarity: true },
  });
  return cards.map((c) => ({
    id: c.id,
    number: c.number,
    name: c.name,
    slug: c.slug,
    rarityLabel: c.rarity.label,
    quoteValue: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(c.quoteValue)),
  }));
}

export async function updateProduct(
  productId: string,
  data: {
    name?: string;
    price?: number;
    stock?: number;
    active?: boolean;
    description?: string;
  },
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.stock !== undefined ? { stock: data.stock } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
}

export async function createProduct(data: {
  sku: string;
  slug: string;
  name: string;
  type: ProductType;
  price: number;
  stock: number;
  description?: string;
}): Promise<string> {
  const p = await prisma.product.create({
    data: {
      sku: data.sku,
      slug: data.slug,
      name: data.name,
      type: data.type,
      price: data.price,
      stock: data.stock,
      description: data.description ?? null,
      images: [],
      active: true,
    },
  });
  return p.id;
}

export async function updateSeason(
  seasonId: string,
  data: { name?: string; releaseDate?: Date | null },
): Promise<void> {
  await prisma.season.update({
    where: { id: seasonId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.releaseDate !== undefined ? { releaseDate: data.releaseDate } : {}),
    },
  });
}

export async function updateOrderStatus(orderId: string, status: import("@/generated/prisma/client").OrderStatus): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}
