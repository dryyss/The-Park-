import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export interface CartLine {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitPrice: string;
  unitPriceRaw: number;
  quantity: number;
  lineTotal: string;
  inStock: boolean;
  stock: number;
}

export interface CartSummary {
  lines: CartLine[];
  itemCount: number;
  subtotal: string;
  subtotalRaw: number;
  shippingEstimate: string;
  total: string;
}

export async function getViewerCart(userId: string): Promise<CartSummary> {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { product: true },
  });

  let subtotalRaw = 0;
  let itemCount = 0;

  const lines: CartLine[] = items.map((item) => {
    const unitPriceRaw = Number(String(item.product.price));
    const lineRaw = unitPriceRaw * item.quantity;
    subtotalRaw += lineRaw;
    itemCount += item.quantity;
    return {
      id: item.id,
      productId: item.productId,
      slug: item.product.slug,
      name: item.product.name,
      image: item.product.images[0] ?? null,
      unitPrice: formatPrice(item.product.price),
      unitPriceRaw,
      quantity: item.quantity,
      lineTotal: formatPrice(lineRaw),
      inStock: item.product.stock >= item.quantity,
      stock: item.product.stock,
    };
  });

  const shippingRaw = subtotalRaw > 0 ? (subtotalRaw >= 50 ? 0 : 4.9) : 0;

  return {
    lines,
    itemCount,
    subtotal: formatPrice(subtotalRaw),
    subtotalRaw,
    shippingEstimate: formatPrice(shippingRaw),
    total: formatPrice(subtotalRaw + shippingRaw),
  };
}

export async function getCartItemCount(userId: string): Promise<number> {
  const agg = await prisma.cartItem.aggregate({
    where: { userId },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}
