import "server-only";
import { prisma } from "@/lib/prisma";
import type { Language, ProductType } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";

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
    description?: string | null;
    images?: string[];
    releaseDate?: Date | null;
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
      ...(data.images !== undefined ? { images: data.images } : {}),
      ...(data.releaseDate !== undefined ? { releaseDate: data.releaseDate } : {}),
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
  description?: string | null;
  images?: string[];
  releaseDate?: Date | null;
}): Promise<string> {
  const p = await prisma.product.create({
    data: {
      sku: data.sku,
      slug: data.slug,
      name: data.name,
      type: data.type,
      price: data.price,
      stock: data.stock,
      description: data.description?.trim() || null,
      images: data.images ?? [],
      releaseDate: data.releaseDate ?? null,
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
    data: {
      status,
      ...(status === "SHIPPED" ? { shippedAt: new Date() } : {}),
    },
  });
}

export async function updateOrderFulfillment(
  orderId: string,
  data: {
    trackingNumber?: string | null;
    shippingMethod?: string | null;
    status?: import("@/generated/prisma/client").OrderStatus;
  },
): Promise<void> {
  const now = new Date();
  const nextStatus = data.status;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      ...(data.trackingNumber !== undefined ? { trackingNumber: data.trackingNumber || null } : {}),
      ...(data.shippingMethod !== undefined ? { shippingMethod: data.shippingMethod || null } : {}),
      ...(nextStatus !== undefined
        ? {
            status: nextStatus,
            ...(nextStatus === "SHIPPED" ? { shippedAt: now } : {}),
          }
        : {}),
    },
  });
}

// ============================================================================
//  CRUD Catalogue — cartes & variantes (module "catalog")
// ============================================================================

export interface AdminRarityOption {
  id: string;
  code: string;
  label: string;
}

export interface AdminVersionTypeOption {
  id: string;
  code: string;
  label: string;
}

export interface AdminVariantRow {
  id: string;
  versionTypeId: string;
  versionTypeLabel: string;
  language: Language;
  editionLabel: string | null;
  imageUrl: string | null;
}

export interface AdminCardFull {
  id: string;
  number: number;
  name: string;
  slug: string;
  rarityId: string;
  quoteValue: number;
  imageUrl: string | null;
  powerCh: number | null;
  weightKg: number | null;
  country: string | null;
  description: string | null;
  isUnique: boolean;
  variants: AdminVariantRow[];
}

export interface AdminCatalogSeason {
  id: string;
  code: string;
  name: string;
  releaseDate: Date | null;
  cards: AdminCardFull[];
}

function isPrismaErr(err: unknown, code: string): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code?: string }).code === code;
}

export async function getAdminRarities(): Promise<AdminRarityOption[]> {
  const rarities = await prisma.rarity.findMany({ orderBy: { sortOrder: "asc" } });
  return rarities.map((r) => ({ id: r.id, code: r.code, label: r.label }));
}

export async function getAdminVersionTypes(): Promise<AdminVersionTypeOption[]> {
  const versions = await prisma.versionType.findMany({ orderBy: { sortOrder: "asc" } });
  return versions.map((v) => ({ id: v.id, code: v.code, label: v.label }));
}

/** Catalogue complet pour l'admin : saisons → cartes → variantes. */
export async function getAdminCatalog(): Promise<AdminCatalogSeason[]> {
  const seasons = await prisma.season.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      cards: {
        orderBy: { number: "asc" },
        include: { variants: { include: { versionType: true } } },
      },
    },
  });

  return seasons.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    releaseDate: s.releaseDate,
    cards: s.cards.map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      slug: c.slug,
      rarityId: c.rarityId,
      quoteValue: Number(c.quoteValue),
      imageUrl: c.imageUrl,
      powerCh: c.powerCh,
      weightKg: c.weightKg,
      country: c.country,
      description: c.description,
      isUnique: c.isUnique,
      variants: c.variants
        .slice()
        .sort((a, b) => a.versionType.sortOrder - b.versionType.sortOrder)
        .map((v) => ({
          id: v.id,
          versionTypeId: v.versionTypeId,
          versionTypeLabel: v.versionType.label,
          language: v.language,
          editionLabel: v.editionLabel,
          imageUrl: v.imageUrl,
        })),
    })),
  }));
}

async function uniqueCardSlug(name: string): Promise<string> {
  const base = slugify(name) || "carte";
  let slug = base;
  let suffix = 0;
  while (await prisma.card.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

export interface CreateCardInput {
  seasonId: string;
  number: number;
  name: string;
  rarityId: string;
  quoteValue: number;
  imageUrl?: string | null;
  powerCh?: number | null;
  weightKg?: number | null;
  country?: string | null;
  description?: string | null;
  isUnique?: boolean;
}

export async function createCard(input: CreateCardInput): Promise<string> {
  const clash = await prisma.card.findFirst({
    where: { seasonId: input.seasonId, number: input.number },
    select: { id: true },
  });
  if (clash) throw new Error("NUMBER_TAKEN");

  const slug = await uniqueCardSlug(input.name);
  try {
    const card = await prisma.card.create({
      data: {
        seasonId: input.seasonId,
        number: input.number,
        name: input.name,
        slug,
        rarityId: input.rarityId,
        quoteValue: input.quoteValue,
        imageUrl: input.imageUrl ?? null,
        powerCh: input.powerCh ?? null,
        weightKg: input.weightKg ?? null,
        country: input.country ?? null,
        description: input.description ?? null,
        isUnique: input.isUnique ?? false,
      },
    });
    return card.id;
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("NUMBER_TAKEN");
    throw err;
  }
}

export interface UpdateCardInput {
  number?: number;
  name?: string;
  rarityId?: string;
  quoteValue?: number;
  imageUrl?: string | null;
  powerCh?: number | null;
  weightKg?: number | null;
  country?: string | null;
  description?: string | null;
  isUnique?: boolean;
}

export async function updateCard(cardId: string, data: UpdateCardInput): Promise<void> {
  try {
    await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(data.number !== undefined ? { number: data.number } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.rarityId !== undefined ? { rarityId: data.rarityId } : {}),
        ...(data.quoteValue !== undefined ? { quoteValue: data.quoteValue } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.powerCh !== undefined ? { powerCh: data.powerCh } : {}),
        ...(data.weightKg !== undefined ? { weightKg: data.weightKg } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isUnique !== undefined ? { isUnique: data.isUnique } : {}),
      },
    });
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("NUMBER_TAKEN");
    throw err;
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  try {
    await prisma.card.delete({ where: { id: cardId } });
  } catch (err) {
    if (isPrismaErr(err, "P2003") || isPrismaErr(err, "P2014")) throw new Error("CARD_IN_USE");
    throw err;
  }
}

export interface CreateVariantInput {
  cardId: string;
  versionTypeId: string;
  language: Language;
  editionLabel?: string | null;
  imageUrl?: string | null;
}

export async function createCardVariant(input: CreateVariantInput): Promise<string> {
  try {
    const variant = await prisma.cardVariant.create({
      data: {
        cardId: input.cardId,
        versionTypeId: input.versionTypeId,
        language: input.language,
        editionLabel: input.editionLabel ?? null,
        imageUrl: input.imageUrl ?? null,
      },
    });
    return variant.id;
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("VARIANT_EXISTS");
    throw err;
  }
}

export interface UpdateVariantInput {
  versionTypeId?: string;
  language?: Language;
  editionLabel?: string | null;
  imageUrl?: string | null;
}

export async function updateCardVariant(variantId: string, data: UpdateVariantInput): Promise<void> {
  try {
    await prisma.cardVariant.update({
      where: { id: variantId },
      data: {
        ...(data.versionTypeId !== undefined ? { versionTypeId: data.versionTypeId } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.editionLabel !== undefined ? { editionLabel: data.editionLabel } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      },
    });
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("VARIANT_EXISTS");
    throw err;
  }
}

export async function deleteCardVariant(variantId: string): Promise<void> {
  try {
    await prisma.cardVariant.delete({ where: { id: variantId } });
  } catch (err) {
    if (isPrismaErr(err, "P2003") || isPrismaErr(err, "P2014")) throw new Error("VARIANT_IN_USE");
    throw err;
  }
}
