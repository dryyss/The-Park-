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
  getAdminCardDetail,
  toCardListItem,
  createCardSet,
  updateCardSet,
  deleteCardSet,
  getAdminCardSets,
  type AdminCardFull,
  type AdminCardListItem,
  type AdminCardSetOption,
  type AdminVariantRow,
} from "@/server/admin/admin.mutations";
import { syncCatalogBadges } from "@/server/badge/badge.service";

export type CatalogActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Résultat d'une mutation de carte : on renvoie la carte fraîche (ligne + détail)
 * pour que le client patche son état local au lieu de recharger tout le catalogue.
 */
export type CatalogCardResult =
  | { ok: true; seasonId: string; card: AdminCardListItem; detail: AdminCardFull }
  | { ok: false; error: string };

export type CatalogVariantResult =
  | { ok: true; cardId: string; variants: AdminVariantRow[] }
  | { ok: false; error: string };

/** Après toute mutation de collection : la liste fraîche pour recâbler les sélecteurs. */
export type CatalogSetResult = { ok: true; sets: AdminCardSetOption[] } | { ok: false; error: string };

/** Recharge une carte et la formate pour le client. */
async function cardResult(cardId: string): Promise<CatalogCardResult> {
  const detail = await getAdminCardDetail(cardId);
  if (!detail) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, seasonId: detail.seasonId, card: toCardListItem(detail), detail };
}

const languageEnum = z.enum(["FR", "EN", "JP", "DE", "US"]);

const nullableUrl = z.string().trim().max(500).nullish();
const nullableInt = z.number().int().min(0).max(100000).nullish();

const createCardSchema = z.object({
  seasonId: z.string().min(1),
  number: z.number().int().min(0).max(9999),
  name: z.string().trim().min(1).max(120),
  rarityId: z.string().min(1),
  quoteValue: z.number().min(0).max(1000000),
  imageUrl: nullableUrl,
  powerCh: nullableInt,
  weightKg: nullableInt,
  country: z.string().trim().max(8).nullish(),
  brand: z.string().trim().max(60).nullish(),
  description: z.string().trim().max(2000).nullish(),
  isUnique: z.boolean().optional(),
});

const updateCardSchema = z.object({
  cardId: z.string().min(1),
  seasonId: z.string().min(1).optional(),
  number: z.number().int().min(0).max(9999).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  rarityId: z.string().min(1).optional(),
  quoteValue: z.number().min(0).max(1000000).optional(),
  imageUrl: nullableUrl,
  powerCh: nullableInt,
  weightKg: nullableInt,
  country: z.string().trim().max(8).nullish(),
  brand: z.string().trim().max(60).nullish(),
  description: z.string().trim().max(2000).nullish(),
  isUnique: z.boolean().optional(),
});

const cardIdSchema = z.object({ cardId: z.string().min(1) });
const variantIdSchema = z.object({ variantId: z.string().min(1) });

const createVariantSchema = z.object({
  cardId: z.string().min(1),
  versionTypeId: z.string().min(1),
  language: languageEnum,
  setId: z.string().min(1).nullish(),
  imageUrl: nullableUrl,
});

const updateVariantSchema = z.object({
  variantId: z.string().min(1),
  versionTypeId: z.string().min(1).optional(),
  language: languageEnum.optional(),
  setId: z.string().min(1).nullish(),
  imageUrl: nullableUrl,
});

const createSetSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(80),
  seriesCode: z.string().trim().max(8).nullish(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const updateSetSchema = createSetSchema.partial().extend({ setId: z.string().min(1) });

const setIdSchema = z.object({ setId: z.string().min(1) });

/** Invalide les caches catalogue (admin + pages publiques taggées). */
function revalidateCatalog() {
  revalidatePath("/[locale]/admin/catalogue", "page");
  revalidatePath("/[locale]/saison-1", "page");
  revalidatePath("/[locale]/hors-serie", "page");
  revalidateTag("catalog");
}

/** Détail complet d'une carte, chargé à l'ouverture de l'éditeur admin. */
export async function getCardDetailAction(input: unknown): Promise<CatalogCardResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = cardIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    return await cardResult(parsed.data.cardId);
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function createCardAction(input: unknown): Promise<CatalogCardResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  if (
    typeof input !== "object" ||
    input === null ||
    (input as { number?: unknown }).number === undefined
  ) {
    return { ok: false, error: "NUMBER_REQUIRED" };
  }

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const id = await createCard(parsed.data);
    await syncCatalogBadges().catch(() => {});
    revalidateCatalog();
    return await cardResult(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCardAction(input: unknown): Promise<CatalogCardResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const { cardId, ...data } = parsed.data;
  try {
    await updateCard(cardId, data);
    await syncCatalogBadges().catch(() => {});
    revalidateCatalog();
    return await cardResult(cardId);
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

/** Recharge les variantes d'une carte après mutation. */
async function variantResult(cardId: string): Promise<CatalogVariantResult> {
  const detail = await getAdminCardDetail(cardId);
  if (!detail) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, cardId, variants: detail.variants };
}

export async function createCardVariantAction(input: unknown): Promise<CatalogVariantResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = createVariantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await createCardVariant(parsed.data);
    revalidateCatalog();
    return await variantResult(parsed.data.cardId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCardVariantAction(input: unknown): Promise<CatalogVariantResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const { variantId, ...data } = parsed.data;
  try {
    const cardId = await updateCardVariant(variantId, data);
    revalidateCatalog();
    return await variantResult(cardId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function deleteCardVariantAction(input: unknown): Promise<CatalogVariantResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = variantIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const cardId = await deleteCardVariant(parsed.data.variantId);
    revalidateCatalog();
    return await variantResult(cardId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

// ── Collections (CardSet) ───────────────────────────────────────────────────
// Le classeur les expose comme axe de navigation : toute mutation invalide donc
// aussi la page collection, en plus du catalogue.

async function setResult(): Promise<CatalogSetResult> {
  return { ok: true, sets: await getAdminCardSets() };
}

function revalidateSets() {
  revalidateCatalog();
  revalidatePath("/[locale]/collection", "page");
}

export async function createCardSetAction(input: unknown): Promise<CatalogSetResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = createSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await createCardSet({ ...parsed.data, seriesCode: parsed.data.seriesCode || null });
    revalidateSets();
    return await setResult();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateCardSetAction(input: unknown): Promise<CatalogSetResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = updateSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const { setId, ...data } = parsed.data;
  try {
    await updateCardSet(setId, {
      ...data,
      ...(data.seriesCode !== undefined ? { seriesCode: data.seriesCode || null } : {}),
    });
    revalidateSets();
    return await setResult();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function deleteCardSetAction(input: unknown): Promise<CatalogSetResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = setIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await deleteCardSet(parsed.data.setId);
    revalidateSets();
    return await setResult();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
