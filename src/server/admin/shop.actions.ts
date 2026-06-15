"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import { createProduct, updateOrderStatus, updateProduct, updateSeason } from "@/server/admin/admin.mutations";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const createProductSchema = z.object({
  sku: z.string().min(1).max(32),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  type: z.enum(["BOOSTER", "DISPLAY", "STARTER_DECK", "PROMO_PACK", "MERCH", "LIMITED_EDITION"]),
  price: z.number().min(0),
  stock: z.number().int().min(0),
});

const updateSeasonSchema = z.object({
  seasonId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  releaseDate: z.string().datetime().nullable().optional(),
});

const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
});

export async function updateProductAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("shop");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateProduct(parsed.data.productId, parsed.data);
    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function createProductAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("shop");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await createProduct(parsed.data);
    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateSeasonAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateSeasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateSeason(parsed.data.seasonId, {
      name: parsed.data.name,
      releaseDate: parsed.data.releaseDate === undefined ? undefined : parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : null,
    });
    revalidatePath("/admin/catalogue");
    revalidatePath("/saison-1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateOrderStatusAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("shop");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateOrderStatus(parsed.data.orderId, parsed.data.status);
    revalidatePath("/admin/commandes");
    revalidatePath("/commandes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
