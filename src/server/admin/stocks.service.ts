import "server-only";
import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@/generated/prisma/client";

export type StockStatus = "IN_STOCK" | "LOW" | "OUT" | "DISCONTINUED";

const LOW_STOCK_THRESHOLD = 5;

function stockStatus(stock: number, active: boolean): StockStatus {
  if (!active) return "DISCONTINUED";
  if (stock === 0) return "OUT";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW";
  return "IN_STOCK";
}

// ── Produits ────────────────────────────────────────────────────────────────

export interface AdminStockProduct {
  id: string;
  sku: string;
  name: string;
  type: string;
  stock: number;
  status: StockStatus;
  active: boolean;
  price: string;
  lastMovement: Date | null;
}

export async function listStockProducts(): Promise<AdminStockProduct[]> {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    type: p.type,
    stock: p.stock,
    status: stockStatus(p.stock, p.active),
    active: p.active,
    price: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(p.price)),
    lastMovement: p.stockMovements[0]?.createdAt ?? null,
  }));
}

export interface AdminStockStats {
  totalProducts: number;
  inStock: number;
  low: number;
  out: number;
  discontinued: number;
}

export async function getStockStats(): Promise<AdminStockStats> {
  const products = await prisma.product.findMany({ select: { stock: true, active: true } });
  const stats: AdminStockStats = { totalProducts: products.length, inStock: 0, low: 0, out: 0, discontinued: 0 };
  for (const p of products) {
    const s = stockStatus(p.stock, p.active);
    if (s === "IN_STOCK") stats.inStock++;
    else if (s === "LOW") stats.low++;
    else if (s === "OUT") stats.out++;
    else stats.discontinued++;
  }
  return stats;
}

// ── Mouvements ───────────────────────────────────────────────────────────────

export interface AdminStockMovementRow {
  id: string;
  productName: string;
  productSku: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  reference: string | null;
  performedBy: string | null;
  createdAt: Date;
}

export async function listStockMovements(opts?: {
  productId?: string;
  type?: StockMovementType;
  take?: number;
}): Promise<AdminStockMovementRow[]> {
  const rows = await prisma.stockMovement.findMany({
    where: {
      ...(opts?.productId ? { productId: opts.productId } : {}),
      ...(opts?.type ? { type: opts.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 200,
    include: { product: { select: { name: true, sku: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    productName: r.product.name,
    productSku: r.product.sku,
    type: r.type,
    quantity: r.quantity,
    stockBefore: r.stockBefore,
    stockAfter: r.stockAfter,
    reason: r.reason,
    reference: r.reference,
    performedBy: r.performedBy,
    createdAt: r.createdAt,
  }));
}

// ── Mutation ─────────────────────────────────────────────────────────────────

export async function adjustStock(input: {
  productId: string;
  type: StockMovementType;
  delta: number; // positif = entrée, négatif = sortie
  reason?: string;
  reference?: string;
  performedBy: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { stock: true },
    });

    const newStock = Math.max(0, product.stock + input.delta);

    await tx.product.update({
      where: { id: input.productId },
      data: { stock: newStock },
    });

    await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantity: input.delta,
        stockBefore: product.stock,
        stockAfter: newStock,
        reason: input.reason ?? null,
        reference: input.reference ?? null,
        performedBy: input.performedBy,
      },
    });
  });
}
