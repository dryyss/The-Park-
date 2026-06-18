"use server";

import { getAuthenticatedViewer } from "@/server/user/user.service";
import { exportUserData } from "@/server/user/account.service";

export type AccountActionResult = { ok: true; json: string } | { ok: false; error: string };

export async function exportUserDataAction(): Promise<AccountActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const data = await exportUserData(viewer.id);
    return { ok: true, json: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
