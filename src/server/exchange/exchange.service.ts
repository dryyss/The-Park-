import "server-only";
import { prisma } from "@/lib/prisma";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";
import type { ExchangeStatus } from "@/generated/prisma/client";

export type ExchangeTab = "current" | "done";
export type ExchangeInboxRole = "incoming" | "outgoing" | "active";

export interface ExchangeCardSide {
  name: string;
  image: string | null;
  meta: string;
}

export interface ExchangeListItem {
  id: string;
  shortId: string;
  partnerName: string;
  partnerSlug: string;
  partnerInitial: string;
  summary: string;
  status: ExchangeStatus;
  createdAt: Date;
  isDone: boolean;
  inboxRole: ExchangeInboxRole;
  needsAction: boolean;
}

export interface TradeOpportunity {
  listingId: string;
  cardName: string;
  cardImage: string | null;
  sellerName: string;
  sellerSlug: string;
  sellerInitial: string;
  type: "TRADE" | "SELL_OR_TRADE" | "WANT";
  priceLabel: string;
}

export interface ExchangeCounts {
  incoming: number;
  outgoing: number;
  active: number;
}

export interface ViewerExchangesResult {
  current: ExchangeListItem[];
  done: ExchangeListItem[];
  selected: ExchangeDetail | null;
  counts: ExchangeCounts;
  opportunities: TradeOpportunity[];
}

export interface ExchangeDetail extends ExchangeListItem {
  partnerRating: string;
  partnerReviews: number;
  message: string | null;
  secured: boolean;
  gives: ExchangeCardSide[];
  gets: ExchangeCardSide[];
  viewerIsInitiator: boolean;
}

const DONE_STATUSES: ExchangeStatus[] = ["COMPLETED", "CANCELLED", "NOT_SHIPPED_CANCELLED"];

function shortExchangeId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

function cardMeta(number: number, versionLabel: string, condition: string): string {
  return `#${String(number).padStart(2, "0")} · ${versionLabel} · ${condition}`;
}

function buildSummary(gives: ExchangeCardSide[], gets: ExchangeCardSide[]): string {
  const give = gives.map((g) => g.name).join(", ");
  const get = gets.map((g) => g.name).join(", ");
  if (give && get) return `${give} ⇄ ${get}`;
  return give || get || "—";
}

function inboxRoleFor(status: ExchangeStatus, isInitiator: boolean): ExchangeInboxRole {
  if (status === "PROPOSED") return isInitiator ? "outgoing" : "incoming";
  return "active";
}

async function mapExchange(
  ex: Awaited<ReturnType<typeof fetchExchanges>>[number],
  viewerId: string,
): Promise<{ list: ExchangeListItem; detail: ExchangeDetail }> {
  const isInitiator = ex.initiatorId === viewerId;
  const partner = isInitiator ? ex.recipient : ex.initiator;

  const gives: ExchangeCardSide[] = [];
  const gets: ExchangeCardSide[] = [];

  for (const item of ex.items) {
    const card = item.variant.card;
    const side: ExchangeCardSide = {
      name: card.name,
      image: cardImage(card.imageUrl),
      meta: cardMeta(card.number, item.variant.versionType.label, item.condition),
    };
    const fromViewer = item.fromInitiator === isInitiator;
    if (fromViewer) gives.push(side);
    else gets.push(side);
  }

  const inboxRole = inboxRoleFor(ex.status, isInitiator);

  const listItem: ExchangeListItem = {
    id: ex.id,
    shortId: shortExchangeId(ex.id),
    partnerName: partner.displayName,
    partnerSlug: partner.slug,
    partnerInitial: partner.displayName.charAt(0).toUpperCase(),
    summary: buildSummary(gives, gets),
    status: ex.status,
    createdAt: ex.createdAt,
    isDone: DONE_STATUSES.includes(ex.status),
    inboxRole,
    needsAction: inboxRole === "incoming",
  };

  return {
    list: listItem,
    detail: {
      ...listItem,
      partnerRating: partner.ratingAvg.toFixed(1).replace(".", ","),
      partnerReviews: partner.reviewCount,
      message: ex.message,
      secured: ex.secured,
      gives,
      gets,
      viewerIsInitiator: isInitiator,
    },
  };
}

async function fetchExchanges(userId: string) {
  return prisma.exchange.findMany({
    where: { OR: [{ initiatorId: userId }, { recipientId: userId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { id: true, displayName: true, slug: true, ratingAvg: true, reviewCount: true } },
      recipient: { select: { id: true, displayName: true, slug: true, ratingAvg: true, reviewCount: true } },
      items: {
        include: {
          variant: {
            include: {
              card: { include: { rarity: true } },
              versionType: true,
            },
          },
        },
      },
    },
  });
}

/** Annonces marketplace ouvertes à l'échange (hors propres annonces du viewer si connecté). */
export async function getTradeOpportunities(userId: string | null, limit = 8): Promise<TradeOpportunity[]> {
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(userId ? { sellerId: { not: userId } } : {}),
      type: { in: ["TRADE", "SELL_OR_TRADE", "WANT"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      seller: { select: { displayName: true, slug: true } },
      variant: { include: { card: true } },
    },
  });

  return listings.map((l) => {
    const name = l.seller.displayName;
    const isWant = l.type === "WANT";
    return {
      listingId: l.id,
      cardName: l.variant.card.name,
      cardImage: cardImage(l.variant.card.imageUrl),
      sellerName: name,
      sellerSlug: l.seller.slug,
      sellerInitial: name.charAt(0).toUpperCase(),
      type: l.type as TradeOpportunity["type"],
      priceLabel: isWant ? formatPrice(l.budgetMax) : formatPrice(l.price),
    };
  });
}

/** Échanges du membre connecté (liste + détail + opportunités marketplace). */
export async function getViewerExchanges(
  userId: string,
  tab: ExchangeTab,
  selectedId?: string,
): Promise<ViewerExchangesResult> {
  const [raw, opportunities] = await Promise.all([fetchExchanges(userId), getTradeOpportunities(userId)]);
  const mapped = await Promise.all(raw.map((ex) => mapExchange(ex, userId)));

  const current = mapped.filter((m) => !m.list.isDone).map((m) => m.list);
  const done = mapped.filter((m) => m.list.isDone).map((m) => m.list);

  const counts: ExchangeCounts = {
    incoming: current.filter((c) => c.inboxRole === "incoming").length,
    outgoing: current.filter((c) => c.inboxRole === "outgoing").length,
    active: current.filter((c) => c.inboxRole === "active").length,
  };

  const pool = tab === "done" ? done : current;
  const priorityId =
    selectedId && pool.some((p) => p.id === selectedId)
      ? selectedId
      : current.find((c) => c.needsAction)?.id ?? pool[0]?.id;
  const selected = priorityId ? mapped.find((m) => m.list.id === priorityId)?.detail ?? null : null;

  return { current, done, selected, counts, opportunities };
}

/** Cartes possédées disponibles pour proposer un échange. */
export async function getViewerOwnedCardsForPropose(userId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { userId },
    include: {
      variant: {
        include: { card: true, versionType: true },
      },
    },
    orderBy: { variant: { card: { number: "asc" } } },
    take: 24,
  });

  return items
    .filter((i) => i.quantity > i.reservedQuantity)
    .map((i) => ({
    variantId: i.variantId,
    name: i.variant.card.name,
    number: i.variant.card.number,
    image: cardImage(i.variant.card.imageUrl),
    versionLabel: i.variant.versionType.label,
    quantity: i.quantity,
    availableQuantity: i.quantity - i.reservedQuantity,
  }));
}
