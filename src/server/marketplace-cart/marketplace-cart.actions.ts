"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  addListingToMarketplaceCart,
  getMarketplaceCartItemCount,
  removeMarketplaceCartItem,
} from "@/server/marketplace-cart/marketplace-cart.service";

export type MarketplaceCartActionError =
  | "UNAUTHORIZED"
  | "LISTING_UNAVAILABLE"
  | "NO_PRICE"
  | "SELF_PURCHASE"
  | "ALREADY_SOLD"
  | "IN_OTHER_CART"
  | "VALIDATION"
  | "UNKNOWN";

export type MarketplaceCartActionResult =
  | { ok: true; itemCount: number }
  | { ok: false; error: MarketplaceCartActionError };

const addSchema = z.object({ listingId: z.string().min(1) });
const removeSchema = z.object({ itemId: z.string().min(1) });

function toCartError(code: string): MarketplaceCartActionError {
  const known = new Set<string>([
    "UNAUTHORIZED",
    "LISTING_UNAVAILABLE",
    "NO_PRICE",
    "SELF_PURCHASE",
    "ALREADY_SOLD",
    "IN_OTHER_CART",
    "VALIDATION",
    "INSUFFICIENT_CREDIT",
    "STRIPE_NOT_CONFIGURED",
    "UNKNOWN",
  ]);
  return known.has(code) ? (code as MarketplaceCartActionError) : "UNKNOWN";
}

export async function addToMarketplaceCartAction(input: unknown): Promise<MarketplaceCartActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await addListingToMarketplaceCart(viewer.id, parsed.data.listingId);
    revalidatePath("/marketplace");
    revalidatePath("/marketplace/panier");
    revalidatePath("/panier");
    revalidateTag("listings");
    return { ok: true, itemCount: await getMarketplaceCartItemCount(viewer.id) };
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    return { ok: false, error: toCartError(code) };
  }
}

export async function removeFromMarketplaceCartAction(input: unknown): Promise<MarketplaceCartActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await removeMarketplaceCartItem(viewer.id, parsed.data.itemId);
    revalidatePath("/marketplace");
    revalidatePath("/marketplace/panier");
    revalidatePath("/panier");
    revalidateTag("listings");
    return { ok: true, itemCount: await getMarketplaceCartItemCount(viewer.id) };
  } catch (err) {
    console.error("[marketplace-cart:remove]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}
