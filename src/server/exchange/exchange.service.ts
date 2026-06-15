import "server-only";
import { prisma } from "@/lib/prisma";
import { cardImage } from "@/lib/rarity";
import type { ExchangeStatus } from "@/generated/prisma/client";

export type ExchangeTab = "current" | "done";

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

/** Échanges du membre connecté (liste + détail sélectionné). */
export async function getViewerExchanges(
  userId: string,
  tab: ExchangeTab,
  selectedId?: string,
): Promise<{ current: ExchangeListItem[]; done: ExchangeListItem[]; selected: ExchangeDetail | null }> {
  const raw = await fetchExchanges(userId);
  const mapped = await Promise.all(raw.map((ex) => mapExchange(ex, userId)));

  const current = mapped.filter((m) => !m.list.isDone).map((m) => m.list);
  const done = mapped.filter((m) => m.list.isDone).map((m) => m.list);

  const pool = tab === "done" ? done : current;
  const pickId = selectedId && pool.some((p) => p.id === selectedId) ? selectedId : pool[0]?.id;
  const selected = pickId ? mapped.find((m) => m.list.id === pickId)?.detail ?? null : null;

  return { current, done, selected };
}

/** Cartes possédées disponibles pour proposer un échange. */
export async function getViewerOwnedCardsForPropose(userId: string) {
  const items = await prisma.collectionItem.findMany({
    where: { userId, reservedQuantity: 0 },
    include: {
      variant: {
        include: { card: true, versionType: true },
      },
    },
    orderBy: { variant: { card: { number: "asc" } } },
    take: 24,
  });

  return items.map((i) => ({
    variantId: i.variantId,
    name: i.variant.card.name,
    number: i.variant.card.number,
    image: cardImage(i.variant.card.imageUrl),
    versionLabel: i.variant.versionType.label,
  }));
}
