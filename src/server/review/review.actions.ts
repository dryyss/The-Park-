"use server";

import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createReview } from "@/server/review/review.service";
import { revalidatePath } from "next/cache";

export interface ReviewActionResult {
  ok: boolean;
  error?: string;
}

export async function submitReviewAction(input: {
  targetId: string;
  source: "SALE" | "EXCHANGE";
  saleId?: string;
  exchangeId?: string;
  rating: number;
  comment?: string;
}): Promise<ReviewActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  if (input.rating < 1 || input.rating > 5) return { ok: false, error: "INVALID_RATING" };

  try {
    await createReview({
      authorId: viewer.id,
      targetId: input.targetId,
      source: input.source,
      saleId: input.saleId,
      exchangeId: input.exchangeId,
      rating: input.rating,
      comment: input.comment,
    });

    if (input.exchangeId) revalidatePath("/echanges");
    if (input.saleId) revalidatePath("/dashboard");
    revalidatePath("/profil");

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "SELF_REVIEW") return { ok: false, error: "SELF_REVIEW" };
    // Unique constraint = already reviewed
    if (msg.includes("Unique constraint")) return { ok: false, error: "ALREADY_REVIEWED" };
    return { ok: false, error: msg };
  }
}
