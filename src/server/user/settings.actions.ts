"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { saveUserNotificationPrefs, type NotificationPrefs } from "@/server/user/settings.service";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

const prefsSchema = z.object({
  exchanges: z.boolean(),
  messages: z.boolean(),
  auctions: z.boolean(),
  orders: z.boolean(),
  marketing: z.boolean(),
});

export async function saveNotificationPrefsAction(input: unknown): Promise<SettingsActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await saveUserNotificationPrefs(viewer.id, parsed.data as NotificationPrefs);
    revalidatePath("/parametres");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
