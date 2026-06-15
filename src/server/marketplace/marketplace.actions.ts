"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { publishListing } from "@/server/marketplace/marketplace.mutations";

export type MarketplaceActionResult = { ok: true; listingId: string } | { ok: false; error: string };

const publishSchema = z.object({
  variantId: z.string().min(1),
  price: z.number().min(0).max(99999),
  description: z.string().max(500).optional(),
});

export async function publishListingAction(input: unknown): Promise<MarketplaceActionResult> {
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
    return { ok: true, listingId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
