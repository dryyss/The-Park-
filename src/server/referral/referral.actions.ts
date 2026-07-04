"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { attachReferralByCode } from "@/server/referral/referral.service";

export type ReferralActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({ code: z.string().min(3).max(16) });

/** Le filleul saisit le code de son parrain (rattachement, récompense au 1er dépôt). */
export async function applyReferralCodeAction(input: unknown): Promise<ReferralActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_CODE" };

  const result = await attachReferralByCode(viewer.id, parsed.data.code);
  if (result !== "OK") return { ok: false, error: result };

  revalidatePath("/parrainage");
  return { ok: true };
}
