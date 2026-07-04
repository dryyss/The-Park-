import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { pushUserEvent } from "@/lib/pusher";
import { sendTransactionalEmail, isResendConfigured } from "@/lib/resend";
import { buildNotificationEmail } from "@/server/notification/email-templates";
import { getUserNotificationPrefs } from "@/server/user/settings.service";
import { notificationHref } from "@/lib/notification-display";

type PrefKey = "exchanges" | "messages" | "auctions" | "orders" | "marketing";

const TYPE_PREF: Partial<Record<NotificationType, PrefKey>> = {
  EXCHANGE_PROPOSED: "exchanges",
  EXCHANGE_ACCEPTED: "exchanges",
  EXCHANGE_COMPLETED: "exchanges",
  MESSAGE_RECEIVED: "messages",
  AUCTION_OUTBID: "auctions",
  AUCTION_WON: "auctions",
  AUCTION_ENDED: "auctions",
  ORDER_UPDATE: "orders",
  LISTING_SOLD: "exchanges",
  LISTING_IN_CART: "exchanges",
  LISTING_EXPIRING: "exchanges",
  WISHLIST_LISTING: "exchanges",
  WISHLIST_PRICE_DROP: "exchanges",
  // BADGE_UNLOCKED intentionally omitted — toujours envoyé, indépendamment des préférences
};

export async function dispatchNotification(input: {
  userId: string;
  type: NotificationType;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  emailSubject?: string;
  emailHtml?: string;
}): Promise<string> {
  const prefs = await getUserNotificationPrefs(input.userId);
  const prefKey = TYPE_PREF[input.type];
  if (prefKey && !prefs[prefKey]) {
    return "";
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      actorId: input.actorId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await pushUserEvent(input.userId, "notification", {
    id: notification.id,
    type: input.type,
    payload: input.payload ?? null,
  });

  // Web Push (best-effort) — notification navigateur même app fermée.
  const pushEmail = buildNotificationEmail(input.type, input.payload ?? {});
  void import("@/server/push/push.service")
    .then(({ sendPushToUser }) =>
      sendPushToUser(input.userId, {
        title: "The Park",
        body: pushEmail?.subject ?? "Nouvelle notification",
        url: notificationHref(input.type, input.entityType ?? null, input.entityId ?? null) ?? "/notifications",
        tag: input.type,
      }),
    )
    .catch((err) => console.error("[push] dispatch failed", err));

  if (input.emailSubject && input.emailHtml) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (user?.email) {
      await sendTransactionalEmail({ to: user.email, subject: input.emailSubject, html: input.emailHtml });
    }
  } else if (isResendConfigured()) {
    const email = buildNotificationEmail(input.type, input.payload ?? {});
    if (email) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (user?.email) {
        await sendTransactionalEmail({ to: user.email, subject: email.subject, html: email.html });
      }
    }
  }

  return notification.id;
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
