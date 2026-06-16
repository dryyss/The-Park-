"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { placeBid } from "@/server/auction/auction.mutations";

export type AuctionActionResult = { ok: true; bidId?: string } | { ok: false; error: string };

const bidSchema = z.object({
  auctionId: z.string().min(1),
  amount: z.number().min(0.01).max(999999),
});

export async function placeBidAction(input: unknown): Promise<AuctionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = bidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const bidId = await placeBid(viewer.id, parsed.data.auctionId, parsed.data.amount);
    revalidatePath("/encheres");
    revalidatePath(`/encheres/${parsed.data.auctionId}`);
    return { ok: true, bidId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
