"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  addCollectionItem,
  removeCollectionItem,
  updateCollectionQuantity,
} from "@/server/collection/collection.mutations";

export type CollectionActionResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  variantId: z.string().min(1),
  condition: z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]).default("EXCELLENT"),
  quantity: z.number().int().min(1).max(99).default(1),
});

const removeSchema = z.object({
  variantId: z.string().min(1),
  condition: z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]).default("EXCELLENT"),
});

const qtySchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
  condition: z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]).default("EXCELLENT"),
});

function revalidateCollection() {
  revalidatePath("/collection");
  revalidatePath("/carte", "layout");
  revalidatePath("/vendre");
}

export async function addToCollectionAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await addCollectionItem(viewer.id, parsed.data.variantId, parsed.data.condition, parsed.data.quantity);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function removeFromCollectionAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await removeCollectionItem(viewer.id, parsed.data.variantId, parsed.data.condition);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCollectionQuantityAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = qtySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateCollectionQuantity(viewer.id, parsed.data.variantId, parsed.data.quantity, parsed.data.condition);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
