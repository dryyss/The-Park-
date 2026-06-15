"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { getCartItemCount } from "@/server/cart/cart.service";

export type CartActionError =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "OUT_OF_STOCK"
  | "VALIDATION"
  | "UNKNOWN";

export type CartActionResult =
  | { ok: true; itemCount: number }
  | { ok: false; error: CartActionError };

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
});

const setQtySchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(0).max(20),
});

const removeSchema = z.object({ itemId: z.string().min(1) });

/** Ajoute un produit au panier (ou incrémente la quantité existante), borné par le stock. */
export async function addToCartAction(input: unknown): Promise<CartActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const { productId, quantity } = parsed.data;

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, active: true },
      select: { id: true, stock: true },
    });
    if (!product) return { ok: false, error: "NOT_FOUND" };
    if (product.stock < 1) return { ok: false, error: "OUT_OF_STOCK" };

    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId: viewer.id, productId } },
      select: { quantity: true },
    });

    const desired = (existing?.quantity ?? 0) + quantity;
    const capped = Math.min(desired, product.stock);

    await prisma.cartItem.upsert({
      where: { userId_productId: { userId: viewer.id, productId } },
      create: { userId: viewer.id, productId, quantity: capped },
      update: { quantity: capped },
    });

    return { ok: true, itemCount: await getCartItemCount(viewer.id) };
  } catch (err) {
    console.error("[cart:add]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/** Définit la quantité d'une ligne ; 0 (ou en-dessous) supprime la ligne. */
export async function setCartQuantityAction(input: unknown): Promise<CartActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = setQtySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const { itemId, quantity } = parsed.data;

  try {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, userId: viewer.id },
      select: { id: true, product: { select: { stock: true } } },
    });
    if (!item) return { ok: false, error: "NOT_FOUND" };

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const capped = Math.min(quantity, item.product.stock);
      if (capped < 1) return { ok: false, error: "OUT_OF_STOCK" };
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: capped } });
    }

    return { ok: true, itemCount: await getCartItemCount(viewer.id) };
  } catch (err) {
    console.error("[cart:setQty]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/** Retire une ligne du panier. */
export async function removeCartItemAction(input: unknown): Promise<CartActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await prisma.cartItem.deleteMany({ where: { id: parsed.data.itemId, userId: viewer.id } });
    return { ok: true, itemCount: await getCartItemCount(viewer.id) };
  } catch (err) {
    console.error("[cart:remove]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}
