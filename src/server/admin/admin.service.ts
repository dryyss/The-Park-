import "server-only";
import { prisma } from "@/lib/prisma";
import { isStaffMember } from "@/server/auth/permissions.service";
export interface AdminOverview {
  members: number;
  activeListings: number;
  openDisputes: number;
  pendingReports: number;
  shopProducts: number;
  lowStockProducts: number;
  ordersPending: number;
  activeAuctions: number;
}

export interface AdminShopProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  type: import("@/generated/prisma/client").ProductType;
  price: string;
  priceValue: number;
  stock: number;
  active: boolean;
  description: string | null;
  images: string[];
  releaseDate: string | null;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [members, activeListings, openDisputes, pendingReports, shopProducts, lowStock, ordersPending, activeAuctions] =
    await Promise.all([
      prisma.user.count({ where: { role: "MEMBER", status: "ACTIVE" } }),
      prisma.listing.count({ where: { status: "ACTIVE" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_EVIDENCE"] } } }),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.product.count({ where: { active: true } }),
      prisma.product.count({ where: { active: true, stock: { lte: 5 } } }),
      prisma.order.count({ where: { status: { in: ["PENDING", "PAID", "PREPARING"] } } }),
      prisma.auction.count({ where: { status: "ACTIVE" } }),
    ]);

  return {
    members,
    activeListings,
    openDisputes,
    pendingReports,
    shopProducts,
    lowStockProducts: lowStock,
    ordersPending,
    activeAuctions,
  };
}

export async function getAdminShopProducts(): Promise<AdminShopProduct[]> {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    type: p.type,
    price: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(p.price)),
    priceValue: Number(p.price),
    stock: p.stock,
    active: p.active,
    description: p.description,
    images: p.images,
    releaseDate: p.releaseDate?.toISOString() ?? null,
  }));
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, staffRole: true },
  });
  return u ? isStaffMember(u) : false;
}