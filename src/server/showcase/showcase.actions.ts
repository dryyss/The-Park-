"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  createShowcase,
  updateShowcaseConfig,
  deleteShowcase,
  reorderShowcases,
  placeCard,
  moveItem,
  removeItem,
  mapShowcaseError,
} from "@/server/showcase/showcase.mutations";
import {
  SHOWCASE_MAX_COLS,
  SHOWCASE_MAX_PAGES,
  SHOWCASE_MAX_ROWS,
  SHOWCASE_MIN_COLS,
  SHOWCASE_MIN_PAGES,
  SHOWCASE_MIN_ROWS,
  SHOWCASE_TITLE_MAX,
} from "@/lib/showcase";

export type ShowcaseActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function revalidateFor(slug: string) {
  revalidatePath(`/collectionneur/${slug}`);
  revalidatePath(`/collectionneur/${slug}/showroom`);
}

const configSchema = z.object({
  title: z.string().max(SHOWCASE_TITLE_MAX).nullish(),
  cols: z.number().int().min(SHOWCASE_MIN_COLS).max(SHOWCASE_MAX_COLS).optional(),
  rows: z.number().int().min(SHOWCASE_MIN_ROWS).max(SHOWCASE_MAX_ROWS).optional(),
  pageCount: z.number().int().min(SHOWCASE_MIN_PAGES).max(SHOWCASE_MAX_PAGES).optional(),
});

export async function createShowcaseAction(input: unknown): Promise<ShowcaseActionResult<{ id: string }>> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = configSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    const showcase = await createShowcase(viewer.id, parsed.data);
    revalidateFor(viewer.slug);
    return { ok: true, data: { id: showcase.id } };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}

const updateSchema = configSchema.extend({ showcaseId: z.string().min(1) });

export async function updateShowcaseConfigAction(input: unknown): Promise<ShowcaseActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const { showcaseId, ...config } = parsed.data;
  try {
    await updateShowcaseConfig(viewer.id, showcaseId, config);
    revalidateFor(viewer.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}

export async function deleteShowcaseAction(showcaseId: string): Promise<ShowcaseActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  if (typeof showcaseId !== "string" || !showcaseId) return { ok: false, error: "VALIDATION" };
  try {
    await deleteShowcase(viewer.id, showcaseId);
    revalidateFor(viewer.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}

export async function reorderShowcasesAction(orderedIds: unknown): Promise<ShowcaseActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = z.array(z.string().min(1)).safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    await reorderShowcases(viewer.id, parsed.data);
    revalidateFor(viewer.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}

const placeSchema = z.object({
  showcaseId: z.string().min(1),
  collectionItemId: z.string().min(1),
  page: z.number().int().min(0),
  slot: z.number().int().min(0),
});

export async function placeCardAction(input: unknown): Promise<ShowcaseActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const { showcaseId, collectionItemId, page, slot } = parsed.data;
  try {
    await placeCard(viewer.id, showcaseId, collectionItemId, page, slot);
    revalidateFor(viewer.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}

const moveSchema = z.object({
  showcaseId: z.string().min(1),
  itemId: z.string().min(1),
  page: z.number().int().min(0),
  slot: z.number().int().min(0),
});

export async function moveItemAction(input: unknown): Promise<ShowcaseActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const { showcaseId, itemId, page, slot } = parsed.data;
  try {
    await moveItem(viewer.id, showcaseId, itemId, page, slot);
    revalidateFor(viewer.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}

const removeSchema = z.object({ showcaseId: z.string().min(1), itemId: z.string().min(1) });

export async function removeItemAction(input: unknown): Promise<ShowcaseActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    await removeItem(viewer.id, parsed.data.showcaseId, parsed.data.itemId);
    revalidateFor(viewer.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapShowcaseError(err) };
  }
}
