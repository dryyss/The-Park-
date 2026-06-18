"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isStripeConfigured } from "@/lib/env";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import { createSaleCheckoutSession, fulfillSaleFromStripeSession } from "@/server/sale/sale-checkout.service";
import { getSaleConversationId } from "@/server/sale/sale.service";

export type BuyListingError =
  | "UNAUTHORIZED"
  | "LISTING_UNAVAILABLE"
  | "NO_PRICE"
  | "SELF_PURCHASE"
  | "ALREADY_SOLD"
  | "VALIDATION"
  | "UNKNOWN";

const buySchema = z.object({
  listingId: z.string().min(1),
  locale: z.string().min(2),
});

/** Démarre l'achat marketplace : réservation + redirect Stripe ou conversation (mode dev). */
export async function buyListingAction(
  input: unknown,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: BuyListingError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = buySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const { saleId } = await createSaleFromListing(viewer.id, parsed.data.listingId);
    revalidatePath("/marketplace");

    if (isStripeConfigured()) {
      const url = await createSaleCheckoutSession(saleId, parsed.data.locale, viewer.id);
      return { ok: true, redirectUrl: url };
    }

    const conversationId = await getSaleConversationId(saleId);
    if (!conversationId) return { ok: false, error: "UNKNOWN" };
    return { ok: true, redirectUrl: `/${parsed.data.locale}/messages/${conversationId}?purchased=1` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (
      msg === "LISTING_UNAVAILABLE" ||
      msg === "NO_PRICE" ||
      msg === "SELF_PURCHASE" ||
      msg === "ALREADY_SOLD"
    ) {
      return { ok: false, error: msg };
    }
    console.error("[sale:buy]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/** Fallback sync après retour Stripe Checkout (comme la boutique). */
export async function confirmSaleCheckoutAction(sessionId: string): Promise<{ ok: boolean }> {
  try {
    await fulfillSaleFromStripeSession(sessionId);
    revalidatePath("/marketplace");
    return { ok: true };
  } catch (err) {
    console.error("[sale:confirmCheckout]", err);
    return { ok: false };
  }
}
