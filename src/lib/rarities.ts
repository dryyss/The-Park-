import { isHorsSerieSeasonCode } from "@/lib/seasons";

export type HoloVariant = "rainbow" | "gold" | "none";

export interface RarityDefinition {
  code: string;
  label: string;
  title: string;
  jp: string;
  symbol: string;
  color: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  sortOrder: number;
}

/** Raretés du catalogue Pocket Drifterz (paramétrables admin). */
export const RARITY_DEFINITIONS = [
  { code: "c", label: "Commune", title: "Communes", jp: "一般", symbol: "◆", color: "#9BA3B2", tilt: 3, holo: 0.3, variant: "rainbow", sortOrder: 0 },
  { code: "r", label: "Rare", title: "Rares", jp: "レア", symbol: "◈", color: "#4FA3FF", tilt: 5, holo: 0.5, variant: "rainbow", sortOrder: 1 },
  { code: "u", label: "Ultra Rare", title: "Ultra Rares", jp: "ウルトラ", symbol: "✦", color: "#B05CFF", tilt: 6, holo: 0.65, variant: "rainbow", sortOrder: 2 },
  { code: "l", label: "Légendaire", title: "Légendaires", jp: "伝説", symbol: "❀", color: "#FF2E63", tilt: 8, holo: 0.8, variant: "rainbow", sortOrder: 3 },
  { code: "g", label: "Gold", title: "Gold", jp: "金", symbol: "✸", color: "#E8B23A", tilt: 8, holo: 0.85, variant: "gold", sortOrder: 4 },
  { code: "unique", label: "Unique", title: "Uniques", jp: "唯一", symbol: "✪", color: "#6FE3D0", tilt: 9, holo: 0.9, variant: "rainbow", sortOrder: 5 },
  { code: "promotional", label: "Promotionnelle", title: "Promotionnelles", jp: "プロモ", symbol: "★", color: "#FF6B9D", tilt: 9, holo: 0.88, variant: "rainbow", sortOrder: 6 },
  { code: "special", label: "Spécial", title: "Spéciales", jp: "特別", symbol: "◇", color: "#A78BFA", tilt: 9, holo: 0.88, variant: "rainbow", sortOrder: 7 },
  { code: "collaboration", label: "Collaboration", title: "Collaborations", jp: "コラボ", symbol: "✧", color: "#34D399", tilt: 9, holo: 0.9, variant: "rainbow", sortOrder: 8 },
  { code: "signed", label: "Signature", title: "Signatures", jp: "サイン", symbol: "✒", color: "#F59E0B", tilt: 9, holo: 0.92, variant: "gold", sortOrder: 9 },
] as const satisfies readonly RarityDefinition[];

export const RARITY_ORDER = RARITY_DEFINITIONS.map((d) => d.code);

/** Codes des raretés hors ligne classique (c → g). */
export const SPECIAL_RARITY_CODES = ["unique", "promotional", "special", "collaboration", "signed"] as const;

/** Raretés exclues du taux de complétion global (trop rares pour être obtenues par tous). */
export const COMPLETION_EXCLUDED_RARITIES = ["unique", "signed"] as const;

export function isExcludedFromCompletion(code: string): boolean {
  return (COMPLETION_EXCLUDED_RARITIES as readonly string[]).includes(code);
}

/** @deprecated Ancien code promo — conservé pour les données historiques. */
const LEGACY_PROMO_CODE = "p";

export function isSpecialRarity(code: string): boolean {
  return (SPECIAL_RARITY_CODES as readonly string[]).includes(code) || code === LEGACY_PROMO_CODE;
}

export function isPromoRarity(code: string): boolean {
  return code === "promotional" || code === LEGACY_PROMO_CODE;
}

export function rarityDefinition(code: string): RarityDefinition | undefined {
  return RARITY_DEFINITIONS.find((d) => d.code === code);
}

export function rarityTitle(code: string): string {
  return rarityDefinition(code)?.title ?? code;
}

export function rarityJp(code: string): string {
  return rarityDefinition(code)?.jp ?? "";
}

/** Chiffre d'édition d'un code série : 1 = 1ère édition, 2 = réédition, "" = indéterminé. */
export function seriesEditionDigit(edition?: "first" | "reprint" | null): "1" | "2" | "" {
  if (edition === "first") return "1";
  if (edition === "reprint") return "2";
  return "";
}

/**
 * Libellé du numéro affiché sous la carte.
 * - Avec code série : "MF1-03" (1ère éd.), "MF2-03" (réédition), "MF-03" (édition indéterminée).
 * - Sans code série : repli historique (03/80, 01 · HS, 00 · PROMO).
 */
export function cardNumberLabel(
  number: number,
  rarityCode: string,
  seasonCode?: string,
  opts?: { seriesCode?: string | null; edition?: "first" | "reprint" | null },
): string {
  const n = String(number).padStart(2, "0");
  const series = opts?.seriesCode?.trim();
  if (series) return `${series}${seriesEditionDigit(opts?.edition)}-${n}`;
  if (seasonCode && isHorsSerieSeasonCode(seasonCode)) return `${n} · HS`;
  if (isPromoRarity(rarityCode)) return `${n} · PROMO`;
  if (isSpecialRarity(rarityCode)) {
    const label = rarityDefinition(rarityCode)?.label ?? rarityCode;
    return `${n} · ${label.toUpperCase()}`;
  }
  return `${n}/80`;
}
