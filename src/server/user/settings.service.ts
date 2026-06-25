import "server-only";
import { prisma } from "@/lib/prisma";

export interface NotificationPrefs {
  exchanges: boolean;
  messages: boolean;
  auctions: boolean;
  orders: boolean;
  marketing: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  exchanges: true,
  messages: true,
  auctions: true,
  orders: true,
  marketing: false,
};

export async function getUserNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  if (!user?.notificationPrefs || typeof user.notificationPrefs !== "object") {
    return DEFAULT_NOTIFICATION_PREFS;
  }
  const raw = user.notificationPrefs as Record<string, unknown>;
  return {
    exchanges: raw.exchanges !== false,
    messages: raw.messages !== false,
    auctions: raw.auctions !== false,
    orders: raw.orders !== false,
    marketing: raw.marketing === true,
  };
}

export async function saveUserNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs as object },
  });
}

export interface PrivacySettings {
  allowFriendRequests: boolean;
  allowMessages: boolean;
}

export async function getPrivacySettings(userId: string): Promise<PrivacySettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { allowFriendRequests: true, allowMessages: true },
  });
  return {
    allowFriendRequests: user?.allowFriendRequests ?? true,
    allowMessages: user?.allowMessages ?? true,
  };
}

export async function savePrivacySettings(userId: string, settings: PrivacySettings): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: settings,
  });
}
