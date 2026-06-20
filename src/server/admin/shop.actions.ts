"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import { createProduct, updateOrderFulfillment, updateOrderStatus, updateProduct, updateSeason } from "@/server/admin/admin.mutations";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const imageUrlSchema = z.string().trim().min(1).max(500);

const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  description: z.string().max(4000).nullable().optional(),
  images: z.array(imageUrlSchema).max(12).optional(),
  releaseDate: z.string().datetime().nullable().optional(),
});

const createProductSchema = z.object({
  sku: z.string().min(1).max(32),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  type: z.enum(["BOOSTER", "DISPLAY", "STARTER_DECK", "PROMO_PACK", "MERCH", "LIMITED_EDITION"]),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  description: z.string().max(4000).nullable().optional(),
  images: z.array(imageUrlSchema).max(12).optional(),
  releaseDate: z.string().datetime().nullable().optional(),
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

const orderFulfillmentSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  trackingNumber: z.string().max(80).nullable().optional(),
  shippingMethod: z.string().max(60).nullable().optional(),
});

export async function updateProductAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("shop");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const { productId, releaseDate, ...rest } = parsed.data;
    await updateProduct(productId, {
      ...rest,
      ...(releaseDate !== undefined
        ? { releaseDate: releaseDate ? new Date(releaseDate) : null }
        : {}),
    });
    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidateTag("shop");
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
    const { releaseDate, ...rest } = parsed.data;
    await createProduct({
      ...rest,
      description: rest.description ?? null,
      images: rest.images ?? [],
      releaseDate: releaseDate ? new Date(releaseDate) : null,
    });
    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidateTag("shop");
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
    revalidateTag("catalog");
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
    revalidatePath(`/admin/commandes/${parsed.data.orderId}`);
    revalidatePath("/commandes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateOrderFulfillmentAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("shop");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = orderFulfillmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateOrderFulfillment(parsed.data.orderId, {
      status: parsed.data.status,
      trackingNumber: parsed.data.trackingNumber,
      shippingMethod: parsed.data.shippingMethod,
    });
    revalidatePath("/admin/commandes");
    revalidatePath(`/admin/commandes/${parsed.data.orderId}`);
    revalidatePath("/commandes");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
