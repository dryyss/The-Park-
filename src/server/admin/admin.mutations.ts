import "server-only";
import { prisma } from "@/lib/prisma";
import type { Language, OrderStatus, Prisma, ProductType } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import { dispatchNotification } from "@/server/notification/notification.mutations";

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
    quoteValue: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
      Number(c.quoteValue),
    ),
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
  data: { name?: string; releaseDate?: Date | null; seriesCode?: string | null },
): Promise<void> {
  await prisma.season.update({
    where: { id: seasonId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.releaseDate !== undefined ? { releaseDate: data.releaseDate } : {}),
      ...(data.seriesCode !== undefined ? { seriesCode: data.seriesCode } : {}),
    },
  });
}

/** Statuts de commande boutique qui déclenchent une notif + e-mail au client. */
const ORDER_NOTIFY_STATUSES = new Set<OrderStatus>([
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

/** Notifie le client (in-app + e-mail Resend) d'une évolution de sa commande boutique. */
async function notifyOrderUpdate(
  orderId: string,
  status: OrderStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, orderNumber: true, trackingNumber: true, shippingMethod: true },
  });
  if (!order?.userId) return;
  await dispatchNotification({
    userId: order.userId,
    type: "ORDER_UPDATE",
    entityType: "ORDER",
    entityId: orderId,
    payload: {
      status,
      orderNumber: order.orderNumber,
      trackingNumber: order.trackingNumber,
      shippingMethod: order.shippingMethod,
      ...extra,
    },
  });
}

/** Notifie le client quand le statut de sa commande boutique évolue. */
async function notifyOrderStatusChange(orderId: string, status: OrderStatus): Promise<void> {
  if (!ORDER_NOTIFY_STATUSES.has(status)) return;
  await notifyOrderUpdate(orderId, status);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(status === "SHIPPED" ? { shippedAt: new Date() } : {}),
    },
  });
  await notifyOrderStatusChange(orderId, status);
}

export async function updateOrderFulfillment(
  orderId: string,
  data: {
    trackingNumber?: string | null;
    shippingMethod?: string | null;
    status?: OrderStatus;
  },
): Promise<void> {
  const before = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, trackingNumber: true },
  });
  if (!before) throw new Error("ORDER_NOT_FOUND");

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

  const statusChanged = nextStatus !== undefined && nextStatus !== before.status;
  const nextTracking =
    data.trackingNumber !== undefined ? data.trackingNumber || null : before.trackingNumber;
  const trackingAdded = Boolean(nextTracking) && nextTracking !== before.trackingNumber;

  // Un changement de statut notifiable porte déjà le n° de suivi à jour : un seul e-mail.
  if (statusChanged && ORDER_NOTIFY_STATUSES.has(nextStatus!)) {
    await notifyOrderStatusChange(orderId, nextStatus!);
  } else if (trackingAdded) {
    await notifyOrderUpdate(orderId, nextStatus ?? before.status, { trackingAdded: true });
  }
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
  /** Collection (CardSet) portant la variante. `null` = carte de base de sa saison. */
  setId: string | null;
  setLabel: string | null;
  imageUrl: string | null;
}

export interface AdminCardSetOption {
  id: string;
  code: string;
  name: string;
  seriesCode: string | null;
  sortOrder: number;
  /** Nombre de déclinaisons rattachées — sert de garde-fou à la suppression. */
  variantCount: number;
}

export async function getAdminCardSets(): Promise<AdminCardSetOption[]> {
  const sets = await prisma.cardSet.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { variants: true } } },
  });
  return sets.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    seriesCode: s.seriesCode,
    sortOrder: s.sortOrder,
    variantCount: s._count.variants,
  }));
}

export interface CardSetInput {
  code: string;
  name: string;
  seriesCode?: string | null;
  sortOrder?: number;
}

export async function createCardSet(input: CardSetInput): Promise<string> {
  try {
    const set = await prisma.cardSet.create({
      data: {
        code: input.code,
        name: input.name,
        seriesCode: input.seriesCode ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return set.id;
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("SET_EXISTS");
    throw err;
  }
}

export async function updateCardSet(setId: string, data: Partial<CardSetInput>): Promise<void> {
  try {
    await prisma.cardSet.update({
      where: { id: setId },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.seriesCode !== undefined ? { seriesCode: data.seriesCode } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("SET_EXISTS");
    if (isPrismaErr(err, "P2025")) throw new Error("NOT_FOUND");
    throw err;
  }
}

/**
 * Supprime une collection vide.
 *
 * Le refus sur collection peuplée est délibéré : la relation est en `SET NULL`,
 * une suppression silencieuse reverserait toutes ses déclinaisons parmi les
 * cartes de base — et pourrait y créer des doublons de clé.
 */
export async function deleteCardSet(setId: string): Promise<void> {
  const count = await prisma.cardVariant.count({ where: { setId } });
  if (count > 0) throw new Error("SET_NOT_EMPTY");
  try {
    await prisma.cardSet.delete({ where: { id: setId } });
  } catch (err) {
    if (isPrismaErr(err, "P2025")) throw new Error("NOT_FOUND");
    throw err;
  }
}

export interface AdminCardFull {
  id: string;
  seasonId: string;
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

/**
 * Ligne de liste du catalogue admin : juste ce qu'il faut pour afficher et filtrer
 * un tableau de cartes. Le détail complet (description, stats, variantes) est chargé
 * à la demande via {@link getAdminCardDetail} quand on ouvre l'éditeur.
 */
export interface AdminCardListItem {
  id: string;
  number: number;
  name: string;
  slug: string;
  rarityId: string;
  quoteValue: number;
  imageUrl: string | null;
  country: string | null;
  brand: string | null;
  isUnique: boolean;
  variantCount: number;
}

export interface AdminCatalogSeason {
  id: string;
  code: string;
  seriesCode: string | null;
  name: string;
  releaseDate: Date | null;
  cards: AdminCardListItem[];
}

function isPrismaErr(err: unknown, code: string): boolean {
  return (
    !!err && typeof err === "object" && "code" in err && (err as { code?: string }).code === code
  );
}

export async function getAdminRarities(): Promise<AdminRarityOption[]> {
  const rarities = await prisma.rarity.findMany({ orderBy: { sortOrder: "asc" } });
  return rarities.map((r) => ({ id: r.id, code: r.code, label: r.label }));
}

export async function getAdminVersionTypes(): Promise<AdminVersionTypeOption[]> {
  const versions = await prisma.versionType.findMany({ orderBy: { sortOrder: "asc" } });
  return versions.map((v) => ({ id: v.id, code: v.code, label: v.label }));
}

/**
 * Index du catalogue admin : saisons → lignes de cartes allégées.
 * On ne descend volontairement pas jusqu'aux variantes ni aux descriptions :
 * sur un catalogue de plusieurs centaines de cartes, la charge utile envoyée au
 * client et le coût de sérialisation sont dominés par ces deux champs.
 */
export async function getAdminCatalog(): Promise<AdminCatalogSeason[]> {
  const seasons = await prisma.season.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      code: true,
      seriesCode: true,
      name: true,
      releaseDate: true,
      cards: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          name: true,
          slug: true,
          rarityId: true,
          quoteValue: true,
          imageUrl: true,
          country: true,
          brand: true,
          isUnique: true,
          _count: { select: { variants: true } },
        },
      },
    },
  });

  return seasons.map((s) => ({
    id: s.id,
    code: s.code,
    seriesCode: s.seriesCode,
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
      country: c.country,
      brand: c.brand,
      isUnique: c.isUnique,
      variantCount: c._count.variants,
    })),
  }));
}

/** Détail complet d'une carte (champs longs + variantes), chargé à l'ouverture de l'éditeur. */
export async function getAdminCardDetail(cardId: string): Promise<AdminCardFull | null> {
  const c = await prisma.card.findUnique({
    where: { id: cardId },
    include: { variants: { include: { versionType: true, set: { select: { name: true } } } } },
  });
  if (!c) return null;

  return {
    id: c.id,
    seasonId: c.seasonId,
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
        setId: v.setId,
        setLabel: v.set?.name ?? null,
        imageUrl: v.imageUrl,
      })),
  };
}

/** Projection « ligne de liste » d'une carte, pour patcher l'état client après mutation. */
export function toCardListItem(card: AdminCardFull): AdminCardListItem {
  return {
    id: card.id,
    number: card.number,
    name: card.name,
    slug: card.slug,
    rarityId: card.rarityId,
    quoteValue: card.quoteValue,
    imageUrl: card.imageUrl,
    country: card.country,
    brand: card.brand,
    isUnique: card.isUnique,
    variantCount: card.variants.length,
  };
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

  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: { code: true },
  });
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
  seasonId?: string;
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

// Numéro tampon (hors plage valide) le temps d'un échange, pour ne pas violer
// la contrainte d'unicité [seasonId, number] pendant la transaction.
const SWAP_TEMP_NUMBER = -1_000_000;

export async function updateCard(cardId: string, data: UpdateCardInput): Promise<void> {
  const current = await prisma.card.findUnique({
    where: { id: cardId },
    select: { seasonId: true, number: true },
  });
  if (!current) throw new Error("NOT_FOUND");

  const targetSeasonId = data.seasonId ?? current.seasonId;
  const targetNumber = data.number ?? current.number;
  const seasonChanged = data.seasonId !== undefined && data.seasonId !== current.seasonId;
  const numberChanged = data.number !== undefined && data.number !== current.number;

  const scalarData = {
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
  };

  // Collision possible sur (saison cible, numéro cible) : contrainte @@unique([seasonId, number]).
  if (seasonChanged || numberChanged) {
    const clash = await prisma.card.findFirst({
      where: { seasonId: targetSeasonId, number: targetNumber, id: { not: cardId } },
      select: { id: true },
    });
    if (clash) {
      // Réordonnancement dans la même saison → on échange les numéros de façon atomique.
      if (!seasonChanged) {
        await prisma.$transaction([
          prisma.card.update({ where: { id: clash.id }, data: { number: SWAP_TEMP_NUMBER } }),
          prisma.card.update({
            where: { id: cardId },
            data: { ...scalarData, number: targetNumber },
          }),
          prisma.card.update({ where: { id: clash.id }, data: { number: current.number } }),
        ]);
        return;
      }
      // Déplacement vers une autre saison où le numéro est déjà pris → refus explicite.
      throw new Error("NUMBER_TAKEN");
    }
  }

  try {
    await prisma.card.update({
      where: { id: cardId },
      data: {
        ...scalarData,
        ...(seasonChanged ? { seasonId: targetSeasonId } : {}),
        ...(numberChanged ? { number: targetNumber } : {}),
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
  setId?: string | null;
  imageUrl?: string | null;
}

/**
 * Postgres ne déduplique pas les NULL : la contrainte `@@unique([cardId,
 * versionTypeId, language, setId])` laisse passer plusieurs cartes de base
 * (`setId = null`). On verrouille ce cas ici.
 */
async function assertVariantFree(
  cardId: string,
  versionTypeId: string,
  language: Language,
  setId: string | null,
  excludeVariantId?: string,
): Promise<void> {
  if (setId !== null) return;
  const clash = await prisma.cardVariant.findFirst({
    where: {
      cardId,
      versionTypeId,
      language,
      setId: null,
      ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new Error("VARIANT_EXISTS");
}

export async function createCardVariant(input: CreateVariantInput): Promise<string> {
  const setId = input.setId ?? null;
  await assertVariantFree(input.cardId, input.versionTypeId, input.language, setId);
  try {
    const variant = await prisma.cardVariant.create({
      data: {
        cardId: input.cardId,
        versionTypeId: input.versionTypeId,
        language: input.language,
        setId,
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
  setId?: string | null;
  imageUrl?: string | null;
}

/** @returns l'id de la carte parente, pour rafraîchir la liste côté client. */
export async function updateCardVariant(
  variantId: string,
  data: UpdateVariantInput,
): Promise<string> {
  const current = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    select: { cardId: true, versionTypeId: true, language: true, setId: true },
  });
  if (!current) throw new Error("NOT_FOUND");

  await assertVariantFree(
    current.cardId,
    data.versionTypeId ?? current.versionTypeId,
    data.language ?? current.language,
    data.setId !== undefined ? data.setId : current.setId,
    variantId,
  );

  try {
    const variant = await prisma.cardVariant.update({
      where: { id: variantId },
      data: {
        ...(data.versionTypeId !== undefined ? { versionTypeId: data.versionTypeId } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.setId !== undefined ? { setId: data.setId } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      },
      select: { cardId: true },
    });
    return variant.cardId;
  } catch (err) {
    if (isPrismaErr(err, "P2002")) throw new Error("VARIANT_EXISTS");
    if (isPrismaErr(err, "P2025")) throw new Error("NOT_FOUND");
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

/** @returns l'id de la carte parente, pour rafraîchir la liste côté client. */
export async function deleteCardVariant(variantId: string): Promise<string> {
  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    select: {
      cardId: true,
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
  return variant.cardId;
}
