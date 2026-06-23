import "server-only";

import { cardImage } from "@/lib/rarity";
import { prisma } from "@/lib/prisma";

export interface CardSeoData {
  slug: string;
  name: string;
  number: number;
  image: string;
  description: string | null;
  rarityLabel: string;
  seasonName: string;
  updatedAt: Date;
}

export interface ProductSeoData {
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  priceRaw: number;
  inStock: boolean;
  updatedAt: Date;
}

export interface CollectorSeoData {
  slug: string;
  displayName: string;
  bio: string | null;
  owned: number;
  total: number;
}

/** Métadonnées SEO légères pour une fiche carte (sans données membre). */
export async function getCardSeoData(slug: string): Promise<CardSeoData | null> {
  const card = await prisma.card.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      number: true,
      imageUrl: true,
      description: true,
      updatedAt: true,
      rarity: { select: { label: true } },
      season: { select: { name: true } },
    },
  });
  if (!card) return null;

  return {
    slug: card.slug,
    name: card.name,
    number: card.number,
    image: cardImage(card.imageUrl),
    description: card.description,
    rarityLabel: card.rarity.label,
    seasonName: card.season.name,
    updatedAt: card.updatedAt,
  };
}

/** Métadonnées SEO légères pour un produit boutique officielle. */
export async function getProductSeoData(slug: string): Promise<ProductSeoData | null> {
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    select: {
      slug: true,
      name: true,
      description: true,
      images: true,
      price: true,
      stock: true,
      updatedAt: true,
    },
  });
  if (!product) return null;

  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    image: product.images[0] ?? null,
    priceRaw: Number(String(product.price)),
    inStock: product.stock > 0,
    updatedAt: product.updatedAt,
  };
}

/** Profil collectionneur public indexable. */
export async function getCollectorSeoData(slug: string): Promise<CollectorSeoData | null> {
  const user = await prisma.user.findFirst({
    where: { slug, status: "ACTIVE", collectionVisibility: "PUBLIC" },
    select: { displayName: true, slug: true, bio: true, id: true },
  });
  if (!user) return null;

  const [owned, total] = await Promise.all([
    prisma.collectionItem.count({ where: { userId: user.id } }),
    prisma.cardVariant.count(),
  ]);

  return {
    slug: user.slug,
    displayName: user.displayName,
    bio: user.bio,
    owned,
    total,
  };
}

/** Slugs des collectionneurs à la collection publique (sitemap). */
export async function getPublicCollectorSlugs(limit = 500): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.user.findMany({
    where: { status: "ACTIVE", collectionVisibility: "PUBLIC" },
    select: { slug: true, updatedAt: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
}
