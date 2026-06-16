"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import { updatePlatformConfig } from "@/server/platform/platform.service";
import { getAdminSeasonCards, updateSeason } from "@/server/admin/admin.mutations";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const platformSchema = z.object({
  shopFreeShippingMin: z.number().min(0).optional(),
  shopStandardShipping: z.number().min(0).optional(),
  shopDefaultCarrier: z.string().min(1).max(40).optional(),
  demoUserSlug: z.string().max(64).nullable().optional(),
  listingDefaultDays: z.number().int().min(1).max(365).optional(),
});

export async function updatePlatformConfigAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("shop");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = platformSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updatePlatformConfig(parsed.data);
    revalidatePath("/admin/reglages");
    revalidatePath("/boutique/panier");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function getAdminSeasonCardsAction(seasonId: string) {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false as const, error: access.reason, cards: [] };
  const cards = await getAdminSeasonCards(seasonId);
  return { ok: true as const, cards };
}

const seasonSchema = z.object({
  seasonId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  releaseDate: z.string().datetime().nullable().optional(),
});

export async function updateSeasonAdminAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("catalog");
  if (!access.ok) return { ok: false, error: access.reason };
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  try {
    await updateSeason(parsed.data.seasonId, {
      name: parsed.data.name,
      releaseDate:
        parsed.data.releaseDate === undefined
          ? undefined
          : parsed.data.releaseDate
            ? new Date(parsed.data.releaseDate)
            : null,
    });
    revalidatePath("/admin/catalogue");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
