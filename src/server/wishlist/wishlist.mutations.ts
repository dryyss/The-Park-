import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CardCondition } from "@/generated/prisma/client";
import { editionPresetToLabel, isFirstEditionLabel, type EditionPresetCode } from "@/lib/card-edition";

export function mapWishlistError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return "ALREADY_EXISTS";
    if (err.code === "P2021" || err.code === "P2022") return "SCHEMA_OUTDATED";
  }
  if (err instanceof Error) {
    if (err.message.includes("Unique constraint")) return "ALREADY_EXISTS";
    if (/does not exist|Unknown column|column .* does not exist/i.test(err.message)) {
      return "SCHEMA_OUTDATED";
    }
    return err.message;
  }
  return "UNKNOWN";
}

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
}

/** Définit (ou retire, si null) le seuil d'alerte prix d'une carte de la wishlist. */
export async function setWishlistItemAlertPrice(
  userId: string,
  wishlistItemId: string,
  alertPrice: number | null,
): Promise<void> {
  if (alertPrice != null && (!Number.isFinite(alertPrice) || alertPrice <= 0)) {
    throw new Error("INVALID_PRICE");
  }
  const updated = await prisma.wishlistItem.updateMany({
    where: { id: wishlistItemId, userId },
    data: { alertPrice: alertPrice == null ? null : new Prisma.Decimal(alertPrice.toFixed(2)) },
  });
  if (updated.count === 0) throw new Error("NOT_FOUND");
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
