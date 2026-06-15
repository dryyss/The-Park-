import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import type { ProductType } from "@/generated/prisma/client";

export type ShopCategory = "all" | "display" | "booster" | "deck" | "merch";

export interface ShopProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  type: ProductType;
  category: ShopCategory;
  categoryLabel: string;
  price: string;
  priceRaw: number;
  stock: number;
  inStock: boolean;
  lowStock: boolean;
  image: string | null;
  description: string | null;
  tag?: string;
}

const TYPE_TO_CATEGORY: Record<ProductType, ShopCategory> = {
  DISPLAY: "display",
  BOOSTER: "booster",
  STARTER_DECK: "deck",
  PROMO_PACK: "booster",
  MERCH: "merch",
  LIMITED_EDITION: "display",
};

const CATEGORY_LABEL: Record<ShopCategory, string> = {
  all: "Tout",
  display: "Display",
  booster: "Booster",
  deck: "Deck",
  merch: "Merch",
};

function mapProduct(p: {
  id: string;
  slug: string;
  sku: string;
  name: string;
  type: ProductType;
  price: unknown;
  stock: number;
  images: string[];
  description: string | null;
}): ShopProduct {
  const category = TYPE_TO_CATEGORY[p.type] ?? "merch";
  const priceRaw = Number(String(p.price));
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    type: p.type,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    price: formatPrice(p.price),
    priceRaw,
    stock: p.stock,
    inStock: p.stock > 0,
    lowStock: p.stock > 0 && p.stock <= 15,
    image: p.images[0] ?? null,
    description: p.description,
    tag: p.type === "LIMITED_EDITION" ? "Édition limitée" : p.stock === 0 ? undefined : p.stock <= 5 ? "Stock faible" : undefined,
  };
}

/** Catalogue boutique officielle (Lighton). */
export async function getShopCatalog(category: ShopCategory = "all"): Promise<ShopProduct[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { price: "asc" }],
  });

  const mapped = products.map(mapProduct);
  if (category === "all") return mapped;
  return mapped.filter((p) => p.category === category);
}

/** Produit vedette (display) pour le hero boutique. */
export async function getFeaturedShopProduct(): Promise<ShopProduct | null> {
  const p = await prisma.product.findFirst({
    where: { active: true, type: "DISPLAY" },
    orderBy: { price: "desc" },
  });
  return p ? mapProduct(p) : null;
}

export async function getShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  const p = await prisma.product.findFirst({ where: { slug, active: true } });
  return p ? mapProduct(p) : null;
}

export { CATEGORY_LABEL as SHOP_CATEGORY_LABELS };
