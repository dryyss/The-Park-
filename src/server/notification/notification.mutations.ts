import "server-only";
import { prisma } from "@/lib/prisma";
import type { AdminRole, Language, NotificationType, Prisma } from "@/generated/prisma/client";
import { pushUserEvent } from "@/lib/pusher";
import { sendTransactionalEmail, isResendConfigured } from "@/lib/resend";
import { buildNotificationEmail } from "@/server/notification/email-templates";
import { getUserNotificationPrefs } from "@/server/user/settings.service";
import { notificationHref } from "@/lib/notification-display";

type PrefKey = "exchanges" | "messages" | "auctions" | "orders" | "marketing";

/** Langue du compte → segment de locale des liens envoyés par e-mail (l'app expose fr/en/ja). */
export function localeFromLanguage(language: Language | null | undefined): string {
  switch (language) {
    case "EN":
    case "US":
      return "en";
    case "JP":
      return "ja";
    default:
      return "fr";
  }
}

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

/**
 * Complète le payload avec le pseudo de l'auteur de l'action (« Yuki t'a écrit »).
 * Best-effort : l'e-mail reste correct sans, avec une formulation neutre.
 */
async function withActorName(
  payload: Record<string, unknown>,
  actorId: string | undefined,
): Promise<Record<string, unknown>> {
  if (!actorId || payload.actorName) return payload;
  const actor = await prisma.user
    .findUnique({ where: { id: actorId }, select: { displayName: true } })
    .catch(() => null);
  return actor?.displayName ? { ...payload, actorName: actor.displayName } : payload;
}

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

  const needsEmail = Boolean(input.emailSubject && input.emailHtml) || isResendConfigured();
  if (needsEmail) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, displayName: true, language: true },
    });
    if (user?.email) {
      // Nom de l'auteur de l'action : résolu une fois ici plutôt qu'à chaque site d'appel.
      const payload = await withActorName(input.payload ?? {}, input.actorId);
      const email =
        input.emailSubject && input.emailHtml
          ? { subject: input.emailSubject, html: input.emailHtml }
          : buildNotificationEmail(input.type, payload, {
              entityType: input.entityType ?? null,
              entityId: input.entityId ?? null,
              locale: localeFromLanguage(user.language),
              recipientName: user.displayName,
            });
      if (email) {
        await sendTransactionalEmail({ to: user.email, subject: email.subject, html: email.html });
      }
    }
  }

  return notification.id;
}

/** Sous-rôles staff concernés par l'activité boutique (commandes, stocks). */
const SHOP_STAFF_ROLES: AdminRole[] = ["OWNER", "SHOP_MANAGER"];

/**
 * Notifie le staff boutique (owner + gestionnaires boutique) d'un évènement
 * back-office. Les comptes ADMIN historiques sans `staffRole` sont traités
 * comme OWNER, comme dans `permissions.service`.
 */
export async function dispatchNotificationToShopStaff(
  input: Omit<Parameters<typeof dispatchNotification>[0], "userId">,
): Promise<number> {
  const staff = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      deletedAt: null,
      OR: [{ staffRole: { in: SHOP_STAFF_ROLES } }, { staffRole: null }],
    },
    select: { id: true },
  });

  let sent = 0;
  for (const member of staff) {
    if (member.id === input.actorId) continue;
    try {
      await dispatchNotification({ ...input, userId: member.id });
      sent += 1;
    } catch (err) {
      console.error("[notification] staff dispatch failed", member.id, err);
    }
  }
  return sent;
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
