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

export function badgeIcon(code: string): string {
  return BADGE_ICONS[code] ?? "★";
}
