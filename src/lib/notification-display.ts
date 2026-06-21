import type { NotificationType } from "@/generated/prisma/client";

export type NotificationCategory = "all" | "trade" | "market" | "sale" | "wallet" | "badge";

export interface NotificationVisual {
  icon: string;
  iconBg: string;
  iconColor: string;
}

const TRADE_TYPES: NotificationType[] = [
  "EXCHANGE_PROPOSED",
  "EXCHANGE_ACCEPTED",
  "EXCHANGE_COMPLETED",
];

const MARKET_TYPES: NotificationType[] = [
  "OFFER_RECEIVED",
  "AUCTION_OUTBID",
  "AUCTION_WON",
  "AUCTION_ENDED",
  "LISTING_IN_CART",
  "LISTING_EXPIRING",
  "WISHLIST_LISTING",
  "MESSAGE_RECEIVED",
];

const SALE_TYPES: NotificationType[] = [
  "SALE_CREATED",
  "LISTING_SOLD",
  "SHIPMENT_SHIPPED",
  "SHIPMENT_DELIVERED",
  "REVIEW_RECEIVED",
  "GUARANTEE_EXPIRING",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
];

const WALLET_TYPES: NotificationType[] = ["PAYMENT_AUTHORIZED", "ORDER_UPDATE"];

export function notificationCategory(type: NotificationType): NotificationCategory {
  if (TRADE_TYPES.includes(type)) return "trade";
  if (MARKET_TYPES.includes(type)) return "market";
  if (SALE_TYPES.includes(type)) return "sale";
  if (WALLET_TYPES.includes(type)) return "wallet";
  if (type === "BADGE_UNLOCKED") return "badge";
  return "all";
}

export function notificationVisual(type: NotificationType): NotificationVisual {
  const cat = notificationCategory(type);
  const styles: Record<NotificationCategory, NotificationVisual> = {
    all: { icon: "◆", iconBg: "rgba(216,27,96,0.12)", iconColor: "#ff2e63" },
    trade: { icon: "⇄", iconBg: "rgba(79,163,255,0.12)", iconColor: "#4fa3ff" },
    market: { icon: "◈", iconBg: "rgba(216,27,96,0.12)", iconColor: "#ff2e63" },
    sale: { icon: "€", iconBg: "rgba(94,217,154,0.12)", iconColor: "#5ed99a" },
    wallet: { icon: "財", iconBg: "rgba(232,178,58,0.12)", iconColor: "#e8b23a" },
    badge: { icon: "★", iconBg: "rgba(176,92,255,0.12)", iconColor: "#b05cff" },
  };
  return styles[cat];
}

export function relativeTimeLabel(date: Date, locale: string): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return locale.startsWith("ja") ? "たった今" : locale.startsWith("en") ? "just now" : "à l'instant";
  if (mins < 60) {
    return locale.startsWith("ja")
      ? `${mins}分前`
      : locale.startsWith("en")
        ? `${mins} min ago`
        : `il y a ${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return locale.startsWith("ja")
      ? `${hours}時間前`
      : locale.startsWith("en")
        ? `${hours} h ago`
        : `il y a ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return locale.startsWith("ja")
    ? `${days}日前`
    : locale.startsWith("en")
      ? `${days} d ago`
      : `il y a ${days} j`;
}
