"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createWalletTopUpCheckoutSession, fulfillWalletTopUpFromStripeSession } from "@/server/wallet/wallet-topup.service";
import { WALLET_MIN_TOP_UP_EUR } from "@/lib/wallet";

export type WalletActionError =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "TOP_UP_TOO_LOW"
  | "STRIPE_NOT_CONFIGURED"
  | "UNKNOWN";

const topUpSchema = z.object({
  creditEur: z.number().min(WALLET_MIN_TOP_UP_EUR).max(500),
  locale: z.string().min(2),
});

export async function startWalletTopUpAction(
  input: unknown,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: WalletActionError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = topUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const url = await createWalletTopUpCheckoutSession(viewer.id, parsed.data.locale, parsed.data.creditEur);
    return { ok: true, redirectUrl: url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "TOP_UP_TOO_LOW") return { ok: false, error: "TOP_UP_TOO_LOW" };
    if (msg === "STRIPE_NOT_CONFIGURED") return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
    console.error("[wallet:topUp]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function confirmWalletTopUpAction(sessionId: string): Promise<{ ok: boolean }> {
  try {
    await fulfillWalletTopUpFromStripeSession(sessionId);
    revalidatePath("/portefeuille");
    return { ok: true };
  } catch (err) {
    console.error("[wallet:confirmTopUp]", err);
    return { ok: false };
  }
}
