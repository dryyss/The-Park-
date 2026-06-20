"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { mapStripeCheckoutError } from "@/lib/stripe";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  cancelMarketplaceCheckoutById,
  fulfillMarketplaceCheckoutFromStripeSession,
  getMarketplaceRecap,
  startMarketplaceCartStripeCheckout,
} from "@/server/marketplace-cart/marketplace-cart-checkout.service";

export type MarketplaceCheckoutActionError =
  | "UNAUTHORIZED"
  | "EMPTY_CART"
  | "VALIDATION"
  | "STRIPE_NOT_CONFIGURED"
  | "STRIPE_MIN_AMOUNT"
  | "LISTING_UNAVAILABLE"
  | "ALREADY_SOLD"
  | "UNKNOWN";

const startSchema = z.object({
  locale: z.string().min(2),
  cartItemIds: z.array(z.string().min(1)).optional(),
});

const confirmSchema = z.object({ sessionId: z.string().min(1) });

const cancelSchema = z.object({ checkoutId: z.string().min(1) });

export async function startMarketplaceStripeCheckoutAction(
  input: unknown,
): Promise<{ ok: true; url: string } | { ok: false; error: MarketplaceCheckoutActionError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const recap = await getMarketplaceRecap(viewer.id, parsed.data.cartItemIds);
    if (recap.lines.length === 0) return { ok: false, error: "EMPTY_CART" };

    const { url } = await startMarketplaceCartStripeCheckout({
      buyerId: viewer.id,
      locale: parsed.data.locale,
      cartItemIds: parsed.data.cartItemIds,
    });

    revalidatePath("/marketplace");
    revalidatePath("/marketplace/panier");
    revalidateTag("listings");

    return { ok: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message === "EMPTY_CART") return { ok: false, error: "EMPTY_CART" };
    if (message === "STRIPE_NOT_CONFIGURED") return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
    if (message === "LISTING_UNAVAILABLE") return { ok: false, error: "LISTING_UNAVAILABLE" };
    if (message === "ALREADY_SOLD") return { ok: false, error: "ALREADY_SOLD" };
    if (message.includes("STRIPE_MIN")) return { ok: false, error: "STRIPE_MIN_AMOUNT" };
    console.error("[marketplace-checkout:start]", err);
    return { ok: false, error: mapStripeCheckoutError(err) === "STRIPE_MIN_AMOUNT" ? "STRIPE_MIN_AMOUNT" : "UNKNOWN" };
  }
}

export async function confirmMarketplaceCheckoutAction(
  sessionId: string,
): Promise<{ ok: boolean }> {
  try {
    await fulfillMarketplaceCheckoutFromStripeSession(sessionId);
    revalidatePath("/marketplace");
    revalidatePath("/marketplace/panier");
    revalidatePath("/portefeuille");
    revalidateTag("listings");
    return { ok: true };
  } catch (err) {
    console.error("[marketplace-checkout:confirm]", err);
    return { ok: false };
  }
}

export async function cancelMarketplaceCheckoutAction(input: unknown): Promise<{ ok: boolean }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false };

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  try {
    await cancelMarketplaceCheckoutById(parsed.data.checkoutId, viewer.id);
    revalidateTag("listings");
    return { ok: true };
  } catch (err) {
    console.error("[marketplace-checkout:cancel]", err);
    return { ok: false };
  }
}

export async function getMarketplaceRecapAction(cartItemIds?: string[]) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return null;
  return getMarketplaceRecap(viewer.id, cartItemIds);
}
