"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import {
  createCard,
  updateCard,
  deleteCard,
  createCardVariant,
  updateCardVariant,
  deleteCardVariant,
} from "@/server/admin/admin.mutations";

export type CatalogActionResult = { ok: true; id?: string } | { ok: false; error: string };

const languageEnum = z.enum(["FR", "EN", "JP", "DE", "US"]);

const nullableUrl = z.string().trim().max(500).nullish();
const nullableInt = z.number().int().min(0).max(100000).nullish();

const createCardSchema = z.object({
  seasonId: z.string().min(1),
  number: z.number().int().min(1).max(9999),
  name: z.string().trim().min(1).max(120),
  rarityId: z.string().min(1),
  quoteValue: z.number().min(0).max(1000000),
  imageUrl: nullableUrl,
  powerCh: nullableInt,
  weightKg: nullableInt,
  country: z.string().trim().max(8).nullish(),
  description: z.string().trim().max(2000).nullish(),
  isUnique: z.boolean().optional(),
});

const updateCardSchema = z.object({
  cardId: z.string().min(1),
  number: z.number().int().min(1).max(9999).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  rarityId: z.string().min(1).optional(),
  quoteValue: z.number().min(0).max(1000000).optional(),
  imageUrl: nullableUrl,
  powerCh: nullableInt,
  weightKg: nullableInt,
  country: z.string().trim().max(8).nullish(),
  description: z.string().trim().max(2000).nullish(),
  isUnique: z.boolean().optional(),
});

const cardIdSchema = z.object({ cardId: z.string().min(1) });
const variantIdSchema = z.object({ variantId: z.string().min(1) });

const createVariantSchema = z.object({
  cardId: z.string().min(1),
  versionTypeId: z.string().min(1),
  language: languageEnum,
  editionLabel: z.string().trim().max(64).nullish(),
  imageUrl: nullableUrl,
});

const updateVariantSchema = z.object({
  variantId: z.string().min(1),
  versionTypeId: z.string().min(1).optional(),
  language: languageEnum.optional(),
  editionLabel: z.string().trim().max(64).nullish(),
  imageUrl: nullableUrl,
});

/** Invalide les caches catalogue (admin + pages publiques taggées). */
function revalidateCatalog() {
  revalidatePath("/admin/catalogue");
  revalidatePath("/saison-1");
  revalidateTag("catalog");
}

export async function createCardAction(input: unknown): Promise<CatalogActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const id = await createCard(parsed.data);
    revalidateCatalog();
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCardAction(input: unknown): Promise<CatalogActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const { cardId, ...data } = parsed.data;
  try {
    await updateCard(cardId, data);
    revalidateCatalog();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function deleteCardAction(input: unknown): Promise<CatalogActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = cardIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await deleteCard(parsed.data.cardId);
    revalidateCatalog();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function createCardVariantAction(input: unknown): Promise<CatalogActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = createVariantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const id = await createCardVariant(parsed.data);
    revalidateCatalog();
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCardVariantAction(input: unknown): Promise<CatalogActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const { variantId, ...data } = parsed.data;
  try {
    await updateCardVariant(variantId, data);
    revalidateCatalog();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function deleteCardVariantAction(input: unknown): Promise<CatalogActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = variantIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await deleteCardVariant(parsed.data.variantId);
    revalidateCatalog();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
