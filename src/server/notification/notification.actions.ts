"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { markAllNotificationsRead, markNotificationRead } from "@/server/notification/notification.mutations";

export type NotificationActionResult = { ok: true } | { ok: false; error: string };

export async function markNotificationReadAction(notificationId: string): Promise<NotificationActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  await markNotificationRead(viewer.id, notificationId);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  await markAllNotificationsRead(viewer.id);
  revalidatePath("/notifications");
  return { ok: true };
}
