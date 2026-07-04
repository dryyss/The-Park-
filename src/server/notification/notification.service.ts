import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string>;
  actorName?: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: Date;
}

const TYPE_KEYS: Record<NotificationType, { title: string; body: string }> = {
  EXCHANGE_PROPOSED: { title: "exchangeProposed", body: "exchangeProposedBody" },
  EXCHANGE_ACCEPTED: { title: "exchangeAccepted", body: "exchangeAcceptedBody" },
  EXCHANGE_COMPLETED: { title: "exchangeCompleted", body: "exchangeCompletedBody" },
  SALE_CREATED: { title: "saleCreated", body: "saleCreatedBody" },
  PAYMENT_AUTHORIZED: { title: "paymentAuthorized", body: "paymentAuthorizedBody" },
  SHIPMENT_SHIPPED: { title: "shipmentShipped", body: "shipmentShippedBody" },
  SHIPMENT_DELIVERED: { title: "shipmentDelivered", body: "shipmentDeliveredBody" },
  GUARANTEE_EXPIRING: { title: "guaranteeExpiring", body: "guaranteeExpiringBody" },
  DISPUTE_OPENED: { title: "disputeOpened", body: "disputeOpenedBody" },
  DISPUTE_RESOLVED: { title: "disputeResolved", body: "disputeResolvedBody" },
  OFFER_RECEIVED: { title: "offerReceived", body: "offerReceivedBody" },
  AUCTION_OUTBID: { title: "auctionOutbid", body: "auctionOutbidBody" },
  AUCTION_WON: { title: "auctionWon", body: "auctionWonBody" },
  AUCTION_ENDED: { title: "auctionEnded", body: "auctionEndedBody" },
  REVIEW_RECEIVED: { title: "reviewReceived", body: "reviewReceivedBody" },
  BADGE_UNLOCKED: { title: "badgeUnlocked", body: "badgeUnlockedBody" },
  LISTING_SOLD: { title: "listingSold", body: "listingSoldBody" },
  LISTING_IN_CART: { title: "listingInCart", body: "listingInCartBody" },
  LISTING_EXPIRING: { title: "listingExpiring", body: "listingExpiringBody" },
  WISHLIST_LISTING: { title: "wishlistListing", body: "wishlistListingBody" },
  WISHLIST_PRICE_DROP: { title: "wishlistPriceDrop", body: "wishlistPriceDropBody" },
  ORDER_UPDATE: { title: "orderUpdate", body: "orderUpdateBody" },
  MESSAGE_RECEIVED: { title: "messageReceived", body: "messageReceivedBody" },
  FRIEND_REQUEST: { title: "friendRequest", body: "friendRequestBody" },
  FRIEND_ACCEPTED: { title: "friendAccepted", body: "friendAcceptedBody" },
};

function mapNotification(
  n: Awaited<ReturnType<typeof fetchNotifications>>[number],
  actorName?: string,
): NotificationItem {
  const keys = TYPE_KEYS[n.type];
  const payload = (n.payload ?? {}) as Record<string, string>;
  return {
    id: n.id,
    type: n.type,
    titleKey: keys.title,
    bodyKey: keys.body,
    bodyParams: payload,
    actorName,
    entityType: n.entityType,
    entityId: n.entityId,
    read: n.readAt != null,
    createdAt: n.createdAt,
  };
}

async function fetchNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUserNotifications(userId: string): Promise<NotificationItem[]> {
  const rows = await fetchNotifications(userId);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.id, a.displayName]));
  return rows.map((n) => mapNotification(n, n.actorId ? actorMap.get(n.actorId) : undefined));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
