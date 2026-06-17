// Métadonnées d'affichage par rareté (partagées client/serveur, pur module).
// Le glyphe et la couleur "officiels" viennent de la base (Rarity.symbol / .color) ;
// ici on complète avec l'intensité de l'effet holographique de la carte.

import { RARITY_DEFINITIONS, type HoloVariant } from "@/lib/rarities";

export type { HoloVariant };
export {
  RARITY_DEFINITIONS,
  RARITY_ORDER,
  SPECIAL_RARITY_CODES,
  isSpecialRarity,
  isPromoRarity,
  cardNumberLabel,
  rarityTitle,
  rarityJp,
} from "@/lib/rarities";

export interface RarityMeta {
  tilt: number;
  holo: number;
  variant: HoloVariant;
  glyph: string;
  color: string;
  label: string;
}

export const RARITY_META: Record<string, RarityMeta> = Object.fromEntries(
  RARITY_DEFINITIONS.map((d) => [
    d.code,
    { tilt: d.tilt, holo: d.holo, variant: d.variant, glyph: d.symbol, color: d.color, label: d.label },
  ]),
);

/** Fallback legacy pour l'ancien code promo « p ». */
RARITY_META.p = RARITY_META.unique;

export function rarityMeta(code: string): RarityMeta {
  return RARITY_META[code] ?? RARITY_META.c;
}

/** Chemin public d'une image de carte (Card.imageUrl / CardVariant.imageUrl = nom de fichier). */
export function cardImage(fileName: string | null | undefined): string {
  if (!fileName) return "/uploads/placeholder.jpg";
  return fileName.startsWith("/") ? fileName : `/uploads/${fileName}`;
}
