"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { addWishlistItem, removeWishlistItem } from "@/server/wishlist/wishlist.mutations";

export type WishlistActionResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  cardId: z.string().min(1),
  note: z.string().max(200).optional(),
});

export async function addToWishlistAction(input: unknown): Promise<WishlistActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await addWishlistItem(viewer.id, parsed.data.cardId, parsed.data.note);
    revalidatePath("/wishlist");
    revalidatePath("/carte", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
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
