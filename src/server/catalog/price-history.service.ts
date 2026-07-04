import "server-only";
import { prisma } from "@/lib/prisma";
import type { SaleStatus } from "@/generated/prisma/client";

export interface PriceHistoryPoint {
  /** Date ISO (jour) de la transaction réalisée. */
  date: string;
  price: number;
  source: "sale" | "auction";
}

export interface CardPriceHistory {
  points: PriceHistoryPoint[];
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  /** Prix de la transaction la plus récente. */
  last: number | null;
  /** Cote indicative éditoriale (Card.quoteValue). */
  quoteValue: number;
  /** Écart du dernier prix réalisé vs la cote indicative (ratio, ex. 0.12 = +12 %). */
  lastVsQuote: number | null;
}

/** Ventes marketplace dont le paiement a été encaissé (argent réellement échangé). */
const REALIZED_SALE_STATUSES: SaleStatus[] = [
  "PAID",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "DELIVERED_WINDOW",
  "DELIVERED",
  "COMPLETED",
  "GUARANTEE_SUSPENDED",
  "DISPUTED",
];

function toNum(value: { toString(): string } | null | undefined): number {
  return value == null ? 0 : Number(value.toString());
}

function dayIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Historique des prix réalisés d'une carte : ventes marketplace encaissées +
 * enchères remportées, toutes variantes confondues. Alimente la cote de marché.
 */
export async function getCardPriceHistory(
  cardId: string,
  opts: { days?: number; limit?: number } = {},
): Promise<CardPriceHistory> {
  const since = opts.days ? new Date(Date.now() - opts.days * 86400 * 1000) : undefined;

  const [card, sales, auctions] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId }, select: { quoteValue: true } }),
    prisma.sale.findMany({
      where: {
        status: { in: REALIZED_SALE_STATUSES },
        listing: { variant: { cardId } },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { price: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auction.findMany({
      where: {
        status: "SOLD",
        variant: { cardId },
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      select: { currentPrice: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const points: PriceHistoryPoint[] = [
    ...sales.map((s) => ({ date: dayIso(s.createdAt), price: toNum(s.price), source: "sale" as const })),
    ...auctions
      .map((a) => ({ date: dayIso(a.updatedAt), price: toNum(a.currentPrice), source: "auction" as const }))
      .filter((p) => p.price > 0),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const trimmed = opts.limit && points.length > opts.limit ? points.slice(points.length - opts.limit) : points;

  const prices = trimmed.map((p) => p.price);
  const count = prices.length;
  const min = count ? Math.min(...prices) : null;
  const max = count ? Math.max(...prices) : null;
  const avg = count ? prices.reduce((s, p) => s + p, 0) / count : null;
  const last = count ? trimmed[trimmed.length - 1]!.price : null;

  const quote = toNum(card?.quoteValue);
  const lastVsQuote = last != null && quote > 0 ? (last - quote) / quote : null;

  return { points: trimmed, count, min, max, avg, last, quoteValue: quote, lastVsQuote };
}
