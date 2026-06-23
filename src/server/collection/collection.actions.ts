"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  addCollectionItem,
  removeCollectionItem,
  updateCollectionQuantity,
  adjustCollectionCardQuantity,
  adjustCollectionVariantQuantity,
  updateCollectionEdition,
  updateCollectionGrading,
  updateCollectionSignature,
} from "@/server/collection/collection.mutations";
import { editionPresetToLabel, type EditionPresetCode } from "@/lib/card-edition";

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

const conditionEnum = z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]);

const adjustSchema = z.object({
  cardNumber: z.number().int().min(1).max(999),
  delta: z.union([z.literal(1), z.literal(-1)]),
  condition: conditionEnum.default("EXCELLENT"),
});

const adjustVariantSchema = z.object({
  variantId: z.string().min(1),
  delta: z.union([z.literal(1), z.literal(-1)]),
  condition: conditionEnum.default("EXCELLENT"),
});

const editionSchema = z.object({
  variantId: z.string().min(1),
  preset: z.enum(["first", "unlimited"]),
  condition: z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]).default("EXCELLENT"),
});

const gradingSchema = z.object({
  variantId: z.string().min(1),
  condition: conditionEnum,
  isGraded: z.boolean(),
});

const signatureSchema = z.object({
  variantId: z.string().min(1),
  condition: conditionEnum,
  isSigned: z.boolean(),
  signatureAuthor: z.string().trim().max(120).nullish(),
});

function revalidateCollection() {
  revalidatePath("/collection");
  revalidatePath("/carte", "layout");
  revalidatePath("/profil");
  revalidatePath("/trophees");
  revalidatePath("/vendre");
  revalidatePath("/saison-1");
  revalidatePath("/hors-serie");
  revalidatePath("/echanges");
  revalidatePath("/echanges/proposer");
  // Carousel accueil : comptes possédés par rareté (lecture Neon live).
  for (const locale of ["fr", "en", "ja"] as const) {
    revalidatePath(`/${locale}`);
  }
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

export async function adjustCollectionCardAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await adjustCollectionCardQuantity(viewer.id, parsed.data.cardNumber, parsed.data.delta, parsed.data.condition);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function adjustCollectionVariantAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = adjustVariantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await adjustCollectionVariantQuantity(viewer.id, parsed.data.variantId, parsed.data.delta, parsed.data.condition);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCollectionEditionAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = editionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const editionLabel = editionPresetToLabel(parsed.data.preset as EditionPresetCode);

  try {
    await updateCollectionEdition(viewer.id, parsed.data.variantId, editionLabel, parsed.data.condition);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCollectionGradingAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = gradingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateCollectionGrading(viewer.id, parsed.data.variantId, parsed.data.condition, parsed.data.isGraded);
    revalidateCollection();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCollectionSignatureAction(input: unknown): Promise<CollectionActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateCollectionSignature(
      viewer.id,
      parsed.data.variantId,
      parsed.data.condition,
      parsed.data.isSigned,
      parsed.data.signatureAuthor,
    );
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
