import "server-only";
import { prisma } from "@/lib/prisma";
import type { CardCondition } from "@/generated/prisma/client";
import { editionPresetToLabel, isFirstEditionLabel, type EditionPresetCode } from "@/lib/card-edition";

export async function addWishlistItem(
  userId: string,
  input: {
    cardId: string;
    variantId: string;
    seasonId: string;
    condition: CardCondition;
    editionPreset: EditionPresetCode;
    note?: string;
  },
): Promise<string> {
  const variant = await prisma.cardVariant.findFirst({
    where: { id: input.variantId, cardId: input.cardId },
    select: { id: true, card: { select: { seasonId: true } } },
  });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");
  if (variant.card.seasonId !== input.seasonId) throw new Error("SEASON_MISMATCH");

  const editionPreset = input.editionPreset === "first" ? "first" : "unlimited";

  try {
    const item = await prisma.wishlistItem.upsert({
      where: {
        userId_variantId_condition_editionPreset: {
          userId,
          variantId: input.variantId,
          condition: input.condition,
          editionPreset,
        },
      },
      create: {
        userId,
        cardId: input.cardId,
        variantId: input.variantId,
        seasonId: input.seasonId,
        condition: input.condition,
        editionPreset,
        note: input.note ?? null,
      },
      update: { note: input.note ?? null },
    });
    return item.id;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new Error("ALREADY_EXISTS");
    }
    throw err;
  }
}

export async function removeWishlistItem(userId: string, wishlistItemId: string): Promise<void> {
  const deleted = await prisma.wishlistItem.deleteMany({
    where: { id: wishlistItemId, userId },
  });
  if (deleted.count === 0) throw new Error("NOT_FOUND");
}

/** Libellé d'édition pour affichage wishlist. */
export function wishlistEditionDisplayLabel(editionPreset: string, catalogEditionLabel: string | null): string | null {
  if (editionPreset === "first") return editionPresetToLabel("first");
  return catalogEditionLabel?.trim() || null;
}

export function wishlistIsFirstEdition(editionPreset: string, catalogEditionLabel: string | null): boolean {
  if (editionPreset === "first") return true;
  return isFirstEditionLabel(catalogEditionLabel);
}
