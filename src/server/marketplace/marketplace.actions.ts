"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  cancelListing,
  pauseListing,
  publishListing,
  publishWantListing,
  resumeListing,
} from "@/server/marketplace/marketplace.mutations";

export type MarketplaceActionResult = { ok: true; listingId?: string } | { ok: false; error: string };

const publishSchema = z.object({
  variantId: z.string().min(1),
  price: z.number().min(0).max(99999),
  description: z.string().max(500).optional(),
});

const conditionEnum = z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]);

const listItemSchema = z
  .object({
    variantId: z.string().min(1),
    condition: conditionEnum,
    type: z.enum(["SELL", "TRADE", "SELL_OR_TRADE"]),
    price: z.number().min(0).max(99999).optional(),
  })
  // Une vente exige un prix valide ; un échange pur n'en demande pas.
  .refine((d) => d.type === "TRADE" || (d.price != null && d.price > 0), {
    message: "PRICE_REQUIRED",
  });

/** Met une carte possédée en vente / échange depuis le classeur, pour un état donné. */
export async function listCollectionItemAction(input: unknown): Promise<MarketplaceActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = listItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const listingId = await publishListing(viewer.id, {
      variantId: parsed.data.variantId,
      type: parsed.data.type,
      condition: parsed.data.condition,
      price: parsed.data.price,
    });
    revalidatePath("/marketplace");
    revalidatePath("/carte", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/echanges");
    return { ok: true, listingId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

const wantSchema = z.object({
  variantId: z.string().min(1),
  budgetMax: z.number().min(0).max(99999).optional(),
});

const listingIdSchema = z.object({ listingId: z.string().min(1) });

export async function publishListingAction(input: unknown): Promise<MarketplaceActionResult & { listingId?: string }> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const listingId = await publishListing(viewer.id, {
      variantId: parsed.data.variantId,
      type: "SELL",
      price: parsed.data.price,
      description: parsed.data.description,
    });
    revalidatePath("/marketplace");
    revalidatePath("/vendre");
    revalidatePath("/dashboard");
    return { ok: true, listingId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function publishWantListingAction(input: unknown): Promise<MarketplaceActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = wantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const listingId = await publishWantListing(viewer.id, parsed.data);
    revalidatePath("/marketplace");
    revalidatePath("/dashboard");
    return { ok: true, listingId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function pauseListingAction(input: unknown): Promise<MarketplaceActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = listingIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    await pauseListing(viewer.id, parsed.data.listingId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function resumeListingAction(input: unknown): Promise<MarketplaceActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = listingIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    await resumeListing(viewer.id, parsed.data.listingId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function cancelListingAction(input: unknown): Promise<MarketplaceActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = listingIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    await cancelListing(viewer.id, parsed.data.listingId);
    revalidatePath("/dashboard");
    revalidatePath("/marketplace");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
