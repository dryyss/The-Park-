"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  AUTO_BID_OPTION_FEE_EUR,
  createAuction,
  placeBid,
  purchaseAutoBidOption,
  registerForAuction,
} from "@/server/auction/auction.mutations";
import { getWalletSpendableBalanceEur } from "@/server/wallet/wallet.service";

export type AuctionActionResult =
  | { ok: true; bidId?: string; auctionId?: string; alreadyOwned?: boolean }
  /** `INSUFFICIENT_WALLET` porte le solde et le montant visé pour alimenter la modale de recharge. */
  | { ok: false; error: string; balanceEur?: number; requiredEur?: number };

const bidSchema = z.object({
  auctionId: z.string().min(1),
  amount: z.number().min(0.01).max(999999),
  /** Plafond d'enchère automatique — nécessite l'option payante sur cette enchère. */
  maxAmount: z.number().min(0.01).max(999999).optional(),
});

const auctionIdSchema = z.object({ auctionId: z.string().min(1) });

const registerSchema = z.object({
  auctionId: z.string().min(1),
  addressId: z.string().min(1).nullish(),
  shippingMode: z.enum(["HAND_DELIVERY", "LETTER_TRACKED", "PICKUP_POINT", "COLISSIMO", "SECURED"]),
});

const createSchema = z.object({
  variantId: z.string().min(1),
  startPrice: z.number().min(0.01).max(99999),
  durationDays: z.number().int().min(1).max(14),
  reservePrice: z.number().min(0).max(99999).optional(),
});

export async function createAuctionAction(input: unknown): Promise<AuctionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const auctionId = await createAuction(viewer.id, parsed.data);
    revalidatePath("/[locale]/encheres", "page");
    revalidatePath("/[locale]/vendre", "page");
    revalidatePath("/[locale]/dashboard", "page");
    return { ok: true, auctionId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function placeBidAction(input: unknown): Promise<AuctionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = bidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const bidId = await placeBid(viewer.id, parsed.data.auctionId, parsed.data.amount, {
      maxAmount: parsed.data.maxAmount,
    });
    revalidatePath("/[locale]/encheres", "page");
    revalidatePath(`/encheres/${parsed.data.auctionId}`);
    return { ok: true, bidId };
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (code === "INSUFFICIENT_WALLET") {
      return {
        ok: false,
        error: code,
        balanceEur: await getWalletSpendableBalanceEur(viewer.id),
        // C'est le plafond qui est engagé, pas la mise affichée : c'est ce montant
        // que la modale de recharge doit viser.
        requiredEur: parsed.data.maxAmount ?? parsed.data.amount,
      };
    }
    return { ok: false, error: code };
  }
}

/**
 * Inscrit le membre à une enchère (adresse + mode d'envoi). Obligatoire avant de
 * miser. Ré-appelable tant que l'enchère court pour corriger son choix.
 */
export async function registerForAuctionAction(input: unknown): Promise<AuctionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await registerForAuction(viewer.id, parsed.data.auctionId, {
      addressId: parsed.data.addressId ?? null,
      shippingMode: parsed.data.shippingMode,
    });
    revalidatePath(`/encheres/${parsed.data.auctionId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

/** Achète l'option « enchère automatique » sur une enchère (débit portefeuille). */
export async function purchaseAutoBidOptionAction(input: unknown): Promise<AuctionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = auctionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const purchased = await purchaseAutoBidOption(viewer.id, parsed.data.auctionId);
    revalidatePath(`/encheres/${parsed.data.auctionId}`);
    revalidatePath("/[locale]/portefeuille", "page");
    return { ok: true, alreadyOwned: !purchased };
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    if (code === "INSUFFICIENT_CREDIT") {
      return {
        ok: false,
        error: "INSUFFICIENT_WALLET",
        balanceEur: await getWalletSpendableBalanceEur(viewer.id),
        requiredEur: AUTO_BID_OPTION_FEE_EUR,
      };
    }
    return { ok: false, error: code };
  }
}
