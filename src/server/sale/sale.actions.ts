"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/env";
import { mapStripeCheckoutError } from "@/lib/stripe";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createSaleFromListing } from "@/server/sale/sale.mutations";
import { getSaleConversationId } from "@/server/sale/sale.service";
import { markSalePaid, markSaleFailed } from "@/server/sale/sale-lifecycle.service";
import { debitWalletForSale } from "@/server/wallet/wallet.service";

export type BuyListingError =
  | "UNAUTHORIZED"
  | "LISTING_UNAVAILABLE"
  | "NO_PRICE"
  | "SELF_PURCHASE"
  | "ALREADY_SOLD"
  | "VALIDATION"
  | "INSUFFICIENT_CREDIT"
  | "STRIPE_NOT_CONFIGURED"
  | "UNKNOWN";

const BUY_ERRORS = new Set<BuyListingError>([
  "UNAUTHORIZED",
  "LISTING_UNAVAILABLE",
  "NO_PRICE",
  "SELF_PURCHASE",
  "ALREADY_SOLD",
  "VALIDATION",
  "INSUFFICIENT_CREDIT",
  "STRIPE_NOT_CONFIGURED",
  "UNKNOWN",
]);

function toBuyListingError(code: string): BuyListingError {
  return BUY_ERRORS.has(code as BuyListingError) ? (code as BuyListingError) : "UNKNOWN";
}

const buySchema = z.object({
  listingId: z.string().min(1),
  locale: z.string().min(2),
});

/** Achète une annonce marketplace via le portefeuille crédits (dépôt Stripe séparé). */
export async function buyListingAction(
  input: unknown,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: BuyListingError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = buySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const { saleId } = await createSaleFromListing(viewer.id, parsed.data.listingId);

    if (isStripeConfigured()) {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        select: { price: true, serviceFee: true },
      });
      if (!sale) return { ok: false, error: "UNKNOWN" };

      const total = Number(sale.price) + Number(sale.serviceFee);

      try {
        await debitWalletForSale({ userId: viewer.id, saleId, amountEur: total });
      } catch (debitErr) {
        await markSaleFailed(saleId);
        if (debitErr instanceof Error && debitErr.message === "INSUFFICIENT_CREDIT") {
          return { ok: false, error: "INSUFFICIENT_CREDIT" };
        }
        throw debitErr;
      }

      await markSalePaid(saleId);
    }

    revalidatePath("/marketplace");
    revalidatePath("/portefeuille");

    const conversationId = await getSaleConversationId(saleId);
    if (conversationId) {
      return { ok: true, redirectUrl: `/${parsed.data.locale}/messages/${conversationId}?purchased=1` };
    }
    return { ok: true, redirectUrl: `/${parsed.data.locale}/marketplace/achat/${saleId}?success=1` };
  } catch (err) {
    if (err instanceof Error) {
      const known = err.message;
      if (
        known === "LISTING_UNAVAILABLE" ||
        known === "NO_PRICE" ||
        known === "SELF_PURCHASE" ||
        known === "ALREADY_SOLD"
      ) {
        return { ok: false, error: toBuyListingError(known) };
      }
    }
    console.error("[sale:buy]", err);
    return { ok: false, error: toBuyListingError(mapStripeCheckoutError(err)) };
  }
}

/** Fallback sync après retour Stripe Checkout boutique (conservé). */
export async function confirmSaleCheckoutAction(sessionId: string): Promise<{ ok: boolean }> {
  const { fulfillSaleFromStripeSession } = await import("@/server/sale/sale-checkout.service");
  try {
    await fulfillSaleFromStripeSession(sessionId);
    revalidatePath("/marketplace");
    return { ok: true };
  } catch (err) {
    console.error("[sale:confirmCheckout]", err);
    return { ok: false };
  }
}
