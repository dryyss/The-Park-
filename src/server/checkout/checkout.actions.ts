"use server";

import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { createCheckoutFromCart } from "@/server/checkout/checkout.service";
import { BOUTIQUE_SHIPPING_MODES, DEFAULT_BOUTIQUE_SHIPPING_MODE } from "@/lib/shipping";

const shippingSchema = z.object({
  locale: z.string().min(2).max(5),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(5).max(200),
  zip: z.string().trim().min(3).max(12),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().length(2).optional(),
  shippingMode: z
    .enum(BOUTIQUE_SHIPPING_MODES.map((m) => m.code) as [string, ...string[]])
    .default(DEFAULT_BOUTIQUE_SHIPPING_MODE),
});

export type CheckoutActionResult =
  | { ok: true; url: string }
  | { ok: false; error: "UNAUTHORIZED" | "EMPTY_CART" | "OUT_OF_STOCK" | "STRIPE_NOT_CONFIGURED" | "VALIDATION" | "UNKNOWN" };

export async function startCheckoutAction(input: unknown): Promise<CheckoutActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  const parsed = shippingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION" };
  }

  const { locale, ...shipping } = parsed.data;

  try {
    const { url } = await createCheckoutFromCart(viewer.id, locale, shipping);
    return { ok: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message === "EMPTY_CART") return { ok: false, error: "EMPTY_CART" };
    if (message === "OUT_OF_STOCK") return { ok: false, error: "OUT_OF_STOCK" };
    if (message === "STRIPE_NOT_CONFIGURED") return { ok: false, error: "STRIPE_NOT_CONFIGURED" };
    console.error("[checkout]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}
