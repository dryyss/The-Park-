"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createWalletTopUpCheckoutSession, fulfillWalletTopUpFromStripeSession } from "@/server/wallet/wallet-topup.service";
import {
  createConnectOnboardingLink,
  createConnectUpdateLink,
  syncConnectAccountForUser,
} from "@/server/wallet/wallet-connect.service";
import { withdrawEarnedToBank } from "@/server/wallet/wallet-withdraw.service";
import { WALLET_MAX_TOP_UP_EUR, WALLET_MIN_TOP_UP_EUR, WALLET_MIN_WITHDRAW_EUR } from "@/lib/wallet";

export type WalletActionError =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "TOP_UP_TOO_LOW"
  | "TERMS_NOT_ACCEPTED"
  | "STRIPE_NOT_CONFIGURED"
  | "UNKNOWN";

export type WalletWithdrawError =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "WITHDRAW_TOO_LOW"
  | "INSUFFICIENT_EARNED"
  | "CONNECT_NOT_SETUP"
  | "CONNECT_PAYOUTS_DISABLED"
  | "STRIPE_NOT_CONFIGURED"
  | "STRIPE_ERROR"
  | "UNKNOWN";

const topUpSchema = z.object({
  creditEur: z.number().min(WALLET_MIN_TOP_UP_EUR).max(WALLET_MAX_TOP_UP_EUR),
  acceptTerms: z.literal(true),
  locale: z.string().min(2),
});

const withdrawSchema = z.object({
  amountEur: z.number().min(WALLET_MIN_WITHDRAW_EUR).max(10_000),
  locale: z.string().min(2),
});

const localeSchema = z.object({ locale: z.string().min(2) });

export async function startWalletTopUpAction(
  input: unknown,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: WalletActionError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = topUpSchema.safeParse(input);
  if (!parsed.success) {
    const termsIssue = parsed.error.issues.some((i) => i.path.includes("acceptTerms"));
    return { ok: false, error: termsIssue ? "TERMS_NOT_ACCEPTED" : "VALIDATION" };
  }

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

export async function startConnectOnboardingAction(
  input: unknown,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: WalletWithdrawError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const url = await createConnectOnboardingLink(viewer.id, parsed.data.locale);
    return { ok: true, redirectUrl: url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "STRIPE_NOT_CONFIGURED") return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
    console.error("[wallet:connectOnboard]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function startConnectUpdateAction(
  input: unknown,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: WalletWithdrawError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const url = await createConnectUpdateLink(viewer.id, parsed.data.locale);
    return { ok: true, redirectUrl: url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "CONNECT_NOT_SETUP") return { ok: false, error: "CONNECT_NOT_SETUP" };
    if (msg === "STRIPE_NOT_CONFIGURED") return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
    console.error("[wallet:connectUpdate]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function syncConnectStatusAction(): Promise<{ ok: boolean }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false };

  try {
    await syncConnectAccountForUser(viewer.id);
    revalidatePath("/portefeuille");
    revalidatePath("/vendre");
    return { ok: true };
  } catch (err) {
    console.error("[wallet:syncConnect]", err);
    return { ok: false };
  }
}

export async function withdrawEarnedAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: WalletWithdrawError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await withdrawEarnedToBank(viewer.id, parsed.data.amountEur);
    revalidatePath("/portefeuille");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const known: WalletWithdrawError[] = [
      "WITHDRAW_TOO_LOW",
      "INSUFFICIENT_EARNED",
      "CONNECT_NOT_SETUP",
      "CONNECT_PAYOUTS_DISABLED",
      "STRIPE_NOT_CONFIGURED",
    ];
    if (known.includes(msg as WalletWithdrawError)) {
      return { ok: false, error: msg as WalletWithdrawError };
    }
    console.error("[wallet:withdraw]", err);
    return { ok: false, error: "STRIPE_ERROR" };
  }
}
