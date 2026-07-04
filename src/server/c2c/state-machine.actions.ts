"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { extendGuaranteeWindow } from "@/server/c2c/state-machine.service";

export type StateMachineActionResult = { ok: true } | { ok: false; error: string };

/** Le receveur prolonge la fenêtre de garantie de 72 h (max 2 fois). */
export async function extendGuaranteeAction(exchangeId: string): Promise<StateMachineActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const res = await extendGuaranteeWindow(exchangeId, viewer.id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/securite/etats");
  revalidatePath("/securite/garantie");
  return { ok: true };
}
