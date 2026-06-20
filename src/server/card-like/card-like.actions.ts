"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { toggleCardLike } from "@/server/card-like/card-like.mutations";

export type CardLikeActionResult =
  | { ok: true; liked: boolean; count: number }
  | { ok: false; error: string };

const schema = z.object({ cardId: z.string().min(1) });

export async function toggleCardLikeAction(input: unknown): Promise<CardLikeActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const { liked, count } = await toggleCardLike(viewer.id, parsed.data.cardId);
    revalidateTag("card-likes");
    revalidateTag("featured-cards");
    revalidateTag("catalog");
    return { ok: true, liked, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
