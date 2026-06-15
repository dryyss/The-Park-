// Métadonnées d'affichage par rareté (partagées client/serveur, pur module).
// Le glyphe et la couleur "officiels" viennent de la base (Rarity.symbol / .color) ;
// ici on complète avec l'intensité de l'effet holographique de la carte.

export type HoloVariant = "rainbow" | "gold" | "none";

export interface RarityMeta {
  tilt: number;
  holo: number;
  variant: HoloVariant;
  glyph: string;
  color: string;
  label: string;
}

export const RARITY_META: Record<string, RarityMeta> = {
  c: { tilt: 3, holo: 0.3, variant: "rainbow", glyph: "◆", color: "#9BA3B2", label: "Commune" },
  r: { tilt: 5, holo: 0.5, variant: "rainbow", glyph: "◈", color: "#4FA3FF", label: "Rare Holo" },
  u: { tilt: 6, holo: 0.65, variant: "rainbow", glyph: "✦", color: "#B05CFF", label: "Ultra Rare" },
  l: { tilt: 8, holo: 0.8, variant: "rainbow", glyph: "❀", color: "#FF2E63", label: "Légendaire" },
  g: { tilt: 8, holo: 0.85, variant: "gold", glyph: "✸", color: "#E8B23A", label: "Gold" },
  p: { tilt: 9, holo: 0.9, variant: "rainbow", glyph: "✪", color: "#6FE3D0", label: "Carte Unique" },
};

export function rarityMeta(code: string): RarityMeta {
  return RARITY_META[code] ?? RARITY_META.c;
}

/** Chemin public d'une image de carte (Card.imageUrl / CardVariant.imageUrl = nom de fichier). */
export function cardImage(fileName: string | null | undefined): string {
  if (!fileName) return "/uploads/placeholder.jpg";
  return fileName.startsWith("/") ? fileName : `/uploads/${fileName}`;
}
