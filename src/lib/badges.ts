/** Icônes affichées pour chaque code de badge (profil, trophées). */
export const BADGE_ICONS: Record<string, string> = {
  first_card: "01",
  first_holo: "✦",
  collector_25: "25",
  legendary_owner: "❀",
  ultra_rare_owner: "✧",
  set_gold: "✸",
  unique_owner: "✪",
  first_trade: "⇄",
  exchange_veteran: "×5",
  first_listing: "◎",
  first_sale: "€",
  first_purchase: "🛒",
  full_season: "100",
  wallet_pioneer: "＋",
};

/** Préfixes des badges générés dynamiquement à partir du catalogue. */
export const SEASON_BADGE_PREFIX = "season_complete_";
export const BRAND_BADGE_PREFIX = "brand_complete_";

/** Normalise un libellé en token de code (minuscule, alphanum + tirets). */
export function slugifyBadgeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Code du badge de complétion d'une saison (ex. "S01" → "season_complete_s01"). */
export function seasonBadgeCode(seasonCode: string): string {
  return `${SEASON_BADGE_PREFIX}${slugifyBadgeToken(seasonCode)}`;
}

/** Code du badge de collection complète d'une marque (ex. "Nissan" → "brand_complete_nissan"). */
export function brandBadgeCode(brand: string): string {
  return `${BRAND_BADGE_PREFIX}${slugifyBadgeToken(brand)}`;
}

export function badgeIcon(code: string): string {
  if (BADGE_ICONS[code]) return BADGE_ICONS[code];
  if (code.startsWith(SEASON_BADGE_PREFIX)) return "🏁";
  if (code.startsWith(BRAND_BADGE_PREFIX)) return "🚗";
  return "★";
}
