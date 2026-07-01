import "server-only";
import { prisma } from "@/lib/prisma";
import type { Language, Prisma, ProductType } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";

type Tx = Prisma.TransactionClient;

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
  brand: string | null;
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
      brand: c.brand,
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

async function uniqueCardSlug(seasonCode: string, number: number, name: string): Promise<string> {
  const base = `${slugify(seasonCode)}-${number}-${slugify(name) || "carte"}`;
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
  brand?: string | null;
  description?: string | null;
  isUnique?: boolean;
}

export async function createCard(input: CreateCardInput): Promise<string> {
  const clash = await prisma.card.findFirst({
    where: { seasonId: input.seasonId, number: input.number },
    select: { id: true },
  });
  if (clash) throw new Error("NUMBER_TAKEN");

  const season = await prisma.season.findUnique({ where: { id: input.seasonId }, select: { code: true } });
  const seasonCode = season?.code ?? "s";
  const slug = await uniqueCardSlug(seasonCode, input.number, input.name);
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
        brand: input.brand ?? null,
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
  brand?: string | null;
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
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
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

async function purgeListingsForVariant(tx: Tx, variantId: string): Promise<void> {
  const listingIds = (
    await tx.listing.findMany({ where: { variantId }, select: { id: true } })
  ).map((l) => l.id);
  if (listingIds.length === 0) return;

  const saleIds = (
    await tx.sale.findMany({ where: { listingId: { in: listingIds } }, select: { id: true } })
  ).map((s) => s.id);

  if (saleIds.length > 0) {
    await tx.marketplaceCheckoutLine.deleteMany({ where: { saleId: { in: saleIds } } });
    await tx.review.deleteMany({ where: { saleId: { in: saleIds } } });
    await tx.conversation.deleteMany({ where: { saleId: { in: saleIds } } });

    const saleDisputeIds = (
      await tx.dispute.findMany({ where: { saleId: { in: saleIds } }, select: { id: true } })
    ).map((d) => d.id);
    if (saleDisputeIds.length > 0) {
      await tx.conversation.deleteMany({ where: { disputeId: { in: saleDisputeIds } } });
      await tx.dispute.deleteMany({ where: { id: { in: saleDisputeIds } } });
    }

    const shipmentIds = (
      await tx.shipment.findMany({ where: { saleId: { in: saleIds } }, select: { id: true } })
    ).map((s) => s.id);
    if (shipmentIds.length > 0) {
      await tx.payment.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
      await tx.trackingEvent.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
      await tx.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
    }

    await tx.payment.deleteMany({ where: { saleId: { in: saleIds } } });
    await tx.sale.deleteMany({ where: { id: { in: saleIds } } });
  }

  await tx.marketplaceCartItem.deleteMany({ where: { listingId: { in: listingIds } } });
  await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
}

async function purgeAuctionsForVariant(tx: Tx, variantId: string): Promise<void> {
  const auctionIds = (
    await tx.auction.findMany({ where: { variantId }, select: { id: true } })
  ).map((a) => a.id);
  if (auctionIds.length === 0) return;

  await tx.bid.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await tx.conversation.deleteMany({ where: { auctionId: { in: auctionIds } } });

  const auctionDisputeIds = (
    await tx.dispute.findMany({ where: { auctionId: { in: auctionIds } }, select: { id: true } })
  ).map((d) => d.id);
  if (auctionDisputeIds.length > 0) {
    await tx.conversation.deleteMany({ where: { disputeId: { in: auctionDisputeIds } } });
    await tx.dispute.deleteMany({ where: { id: { in: auctionDisputeIds } } });
  }

  await tx.payment.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await tx.auction.deleteMany({ where: { id: { in: auctionIds } } });
}

async function purgeCardVariantGraph(tx: Tx, variantId: string): Promise<void> {
  await purgeListingsForVariant(tx, variantId);
  await purgeAuctionsForVariant(tx, variantId);
  await tx.exchangeItem.deleteMany({ where: { variantId } });
  await tx.collectionItem.deleteMany({ where: { variantId } });
  await tx.wishlistItem.deleteMany({ where: { variantId } });
  await tx.cardVariant.delete({ where: { id: variantId } });
}

export async function deleteCardVariant(variantId: string): Promise<void> {
  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    select: {
      card: { select: { _count: { select: { variants: true } } } },
    },
  });
  if (!variant) throw new Error("NOT_FOUND");
  if (variant.card._count.variants <= 1) throw new Error("LAST_VARIANT");

  try {
    await prisma.$transaction((tx) => purgeCardVariantGraph(tx, variantId));
  } catch (err) {
    if (isPrismaErr(err, "P2003") || isPrismaErr(err, "P2014")) throw new Error("VARIANT_IN_USE");
    throw err;
  }
}
