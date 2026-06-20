"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/server/auth/admin-guard";
import { adjustStock } from "@/server/admin/stocks.service";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const adjustSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["RESTOCK", "SALE", "RETURN", "ADJUSTMENT", "LOSS"]),
  delta: z.number().int().refine((n) => n !== 0, "Delta ne peut pas être zéro"),
  reason: z.string().max(200).optional(),
  reference: z.string().max(100).optional(),
});

export async function adjustStockAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("stocks");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await adjustStock({
      ...parsed.data,
      performedBy: access.user.displayName ?? access.user.email ?? access.user.id,
    });
    revalidatePath("/admin/stocks");
    revalidatePath("/boutique");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
