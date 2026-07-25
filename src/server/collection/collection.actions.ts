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
  cardId: z.string().min(1).nullish(),
  cardNumber: z.number().int().min(1).max(999),
  delta: z.union([z.literal(1), z.literal(-1)]),
  condition: conditionEnum.default("EXCELLENT"),
  edition: z.enum(["first", "reprint"]).nullish(),
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

import { GRADE_COMPANIES, GRADE_SCORES, isValidGradeCompany } from "@/lib/grading";

const gradingSchema = z.object({
  variantId: z.string().min(1),
  condition: conditionEnum,
  isGraded: z.boolean().optional(),
  gradeCompany: z.string().trim().max(32).nullish(),
  gradeScore: z.number().min(1).max(10).nullish(),
}).superRefine((data, ctx) => {
  if (data.gradeCompany && !isValidGradeCompany(data.gradeCompany)) {
    ctx.addIssue({ code: "custom", message: "INVALID_COMPANY", path: ["gradeCompany"] });
  }
  if (data.gradeScore != null && !GRADE_SCORES.includes(data.gradeScore)) {
    ctx.addIssue({ code: "custom", message: "INVALID_SCORE", path: ["gradeScore"] });
  }
});

const signatureSchema = z.object({
  variantId: z.string().min(1),
  condition: conditionEnum,
  isSigned: z.boolean(),
  signatureAuthor: z.string().trim().max(120).nullish(),
});

// Les routes sont préfixées par la locale (next-intl, `localePrefix: always`) :
// sans le segment `[locale]`, le chemin ne correspondait à aucune route et
// n'invalidait donc rien — c'est ce qui obligeait à recharger la page à la main.
const COLLECTION_ROUTES = [
  "/[locale]/collection",
  "/[locale]/profil",
  "/[locale]/trophees",
  "/[locale]/vendre",
  "/[locale]/saison-1",
  "/[locale]/saison-2",
  "/[locale]/hors-serie",
  "/[locale]/echanges",
  "/[locale]/echanges/proposer",
] as const;

function revalidateCollection() {
  for (const route of COLLECTION_ROUTES) revalidatePath(route, "page");
  revalidatePath("/[locale]/carte/[slug]", "page");
  // Carousel accueil : comptes possédés par rareté (lecture Neon live).
  revalidatePath("/[locale]", "page");
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
    await adjustCollectionCardQuantity(
      viewer.id,
      { cardId: parsed.data.cardId, cardNumber: parsed.data.cardNumber },
      parsed.data.delta,
      parsed.data.condition,
      parsed.data.edition ?? null,
    );
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

  const targetPreset = parsed.data.preset as EditionPresetCode;
  // L'édition d'origine est l'autre compartiment : c'est la ligne à reclasser.
  const fromPreset: EditionPresetCode = targetPreset === "first" ? "unlimited" : "first";

  try {
    await updateCollectionEdition(
      viewer.id,
      parsed.data.variantId,
      targetPreset,
      parsed.data.condition,
      fromPreset,
    );
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
    await updateCollectionGrading(viewer.id, parsed.data.variantId, parsed.data.condition, {
      isGraded: parsed.data.isGraded,
      gradeCompany: parsed.data.gradeCompany,
      gradeScore: parsed.data.gradeScore,
    });
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
