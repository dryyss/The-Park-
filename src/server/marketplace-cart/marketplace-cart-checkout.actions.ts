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
  startAndFulfillMarketplaceCheckoutWithWallet,
} from "@/server/marketplace-cart/marketplace-cart-checkout.service";

export type MarketplaceCheckoutActionError =
  | "UNAUTHORIZED"
  | "EMPTY_CART"
  | "VALIDATION"
  | "STRIPE_NOT_CONFIGURED"
  | "STRIPE_MIN_AMOUNT"
  | "LISTING_UNAVAILABLE"
  | "ALREADY_SOLD"
  | "INSUFFICIENT_WALLET"
  | "MISSING_ADDRESS"
  | "UNKNOWN";

const shippingFields = {
  shippingMode: z.enum(["HAND_DELIVERY", "LETTER_TRACKED", "PICKUP_POINT", "COLISSIMO", "SECURED"]),
  addressId: z.string().min(1).optional(),
  newAddress: z
    .object({
      fullName: z.string().min(1),
      line1: z.string().min(1),
      line2: z.string().optional(),
      zip: z.string().min(1),
      city: z.string().min(1),
      country: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
};

const startSchema = z.object({
  locale: z.string().min(2),
  cartItemIds: z.array(z.string().min(1)).optional(),
  ...shippingFields,
});

const walletSchema = z.object({
  locale: z.string().min(2),
  cartItemIds: z.array(z.string().min(1)).optional(),
  ...shippingFields,
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
      shipping: {
        shippingMode: parsed.data.shippingMode,
        addressId: parsed.data.addressId,
        newAddress: parsed.data.newAddress,
      },
    });

    revalidatePath("/marketplace");
    revalidatePath("/marketplace/panier");
    revalidatePath("/panier");
    revalidateTag("listings");

    return { ok: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message === "EMPTY_CART") return { ok: false, error: "EMPTY_CART" };
    if (message === "STRIPE_NOT_CONFIGURED") return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
    if (message === "LISTING_UNAVAILABLE") return { ok: false, error: "LISTING_UNAVAILABLE" };
    if (message === "ALREADY_SOLD") return { ok: false, error: "ALREADY_SOLD" };
    if (message === "MISSING_ADDRESS") return { ok: false, error: "MISSING_ADDRESS" };
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
    revalidatePath("/panier");
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

export async function payMarketplaceWithWalletAction(
  input: unknown,
): Promise<{ ok: true; checkoutId: string; locale: string } | { ok: false; error: MarketplaceCheckoutActionError }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = walletSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const recap = await getMarketplaceRecap(viewer.id, parsed.data.cartItemIds);
    if (recap.lines.length === 0) return { ok: false, error: "EMPTY_CART" };

    const { checkoutId } = await startAndFulfillMarketplaceCheckoutWithWallet({
      buyerId: viewer.id,
      cartItemIds: parsed.data.cartItemIds,
      shipping: {
        shippingMode: parsed.data.shippingMode,
        addressId: parsed.data.addressId,
        newAddress: parsed.data.newAddress,
      },
    });

    revalidatePath("/marketplace");
    revalidatePath("/marketplace/panier");
    revalidatePath("/panier");
    revalidatePath("/portefeuille");
    revalidateTag("listings");

    return { ok: true, checkoutId, locale: parsed.data.locale };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message === "EMPTY_CART") return { ok: false, error: "EMPTY_CART" };
    if (message === "LISTING_UNAVAILABLE") return { ok: false, error: "LISTING_UNAVAILABLE" };
    if (message === "ALREADY_SOLD") return { ok: false, error: "ALREADY_SOLD" };
    if (message === "INSUFFICIENT_WALLET") return { ok: false, error: "INSUFFICIENT_WALLET" };
    if (message === "MISSING_ADDRESS") return { ok: false, error: "MISSING_ADDRESS" };
    console.error("[marketplace-checkout:wallet]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function getMarketplaceRecapAction(cartItemIds?: string[]) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return null;
  return getMarketplaceRecap(viewer.id, cartItemIds);
}
