"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createAuction, placeBid } from "@/server/auction/auction.mutations";
import { getWalletSpendableBalanceEur } from "@/server/wallet/wallet.service";

export type AuctionActionResult =
  | { ok: true; bidId?: string; auctionId?: string }
  /** `INSUFFICIENT_WALLET` porte le solde et le montant visé pour alimenter la modale de recharge. */
  | { ok: false; error: string; balanceEur?: number; requiredEur?: number };

const bidSchema = z.object({
  auctionId: z.string().min(1),
  amount: z.number().min(0.01).max(999999),
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
    const bidId = await placeBid(viewer.id, parsed.data.auctionId, parsed.data.amount);
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
        requiredEur: parsed.data.amount,
      };
    }
    return { ok: false, error: code };
  }
}
