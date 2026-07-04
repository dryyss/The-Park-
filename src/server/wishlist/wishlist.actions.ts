"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  addWishlistItem,
  removeWishlistItem,
  setWishlistItemAlertPrice,
  mapWishlistError,
} from "@/server/wishlist/wishlist.mutations";
import { EDITION_PRESET_CODES } from "@/lib/card-edition";
import { CONDITION_ORDER } from "@/lib/condition";

export type WishlistActionResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  cardId: z.string().min(1),
  variantId: z.string().min(1),
  seasonId: z.string().min(1),
  condition: z.enum(CONDITION_ORDER as [string, ...string[]]),
  editionPreset: z.enum(EDITION_PRESET_CODES),
  note: z.string().max(200).optional(),
});

export async function addToWishlistAction(input: unknown): Promise<WishlistActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await addWishlistItem(viewer.id, {
      cardId: parsed.data.cardId,
      variantId: parsed.data.variantId,
      seasonId: parsed.data.seasonId,
      condition: parsed.data.condition as import("@/generated/prisma/client").CardCondition,
      editionPreset: parsed.data.editionPreset,
      note: parsed.data.note,
    });
    revalidatePath("/wishlist");
    revalidatePath("/collection");
    revalidatePath("/marketplace");
    revalidatePath("/carte", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[wishlist] add failed:", err);
    return { ok: false, error: mapWishlistError(err) };
  }
}

const alertSchema = z.object({
  wishlistItemId: z.string().min(1),
  // null = retirer l'alerte prix (revenir à l'alerte de disponibilité).
  alertPrice: z.number().positive().max(1_000_000).nullable(),
});

export async function setWishlistAlertPriceAction(input: unknown): Promise<WishlistActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await setWishlistItemAlertPrice(viewer.id, parsed.data.wishlistItemId, parsed.data.alertPrice);
    revalidatePath("/wishlist");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapWishlistError(err) };
  }
}

export async function removeFromWishlistAction(wishlistItemId: string): Promise<WishlistActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await removeWishlistItem(viewer.id, wishlistItemId);
    revalidatePath("/wishlist");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
