// Pays déclarés par les membres (code ISO-3166-1 alpha-2).
// Le drapeau est dérivé du code (indicateurs régionaux Unicode) ; le nom est
// localisé à la volée via Intl.DisplayNames — pas de table de libellés à maintenir.

/** Codes proposés dans le sélecteur de pays du profil (curaté, orienté communauté auto/JDM). */
export const COUNTRY_CODES = [
  "FR", "JP", "US", "GB", "DE", "IT", "ES", "BE", "CH", "NL",
  "PT", "SE", "NO", "FI", "DK", "PL", "AT", "IE", "LU", "CA",
  "AU", "NZ", "KR", "CN", "TW", "HK", "SG", "TH", "MY", "ID",
  "BR", "MX", "AR", "ZA", "AE", "SA", "TR", "RU", "UA", "CZ",
  "RO", "GR", "MA", "DZ", "TN", "IN", "PH", "VN",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const ISO2_RE = /^[A-Za-z]{2}$/;

/** Drapeau emoji d'un code pays ISO-2 (ex. "JP" → 🇯🇵). Chaîne vide si code invalide. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !ISO2_RE.test(code)) return "";
  const base = 0x1f1e6; // 🇦 (REGIONAL INDICATOR SYMBOL LETTER A)
  const up = code.toUpperCase();
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}

/** Nom du pays localisé pour la locale donnée (ex. "JP", "fr" → "Japon"). Repli : le code brut. */
export function countryName(code: string | null | undefined, locale = "fr"): string {
  if (!code || !ISO2_RE.test(code)) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Drapeau + nom localisé (ex. "🇯🇵 Japon"). Chaîne vide si pas de pays. */
export function countryLabel(code: string | null | undefined, locale = "fr"): string {
  if (!code) return "";
  const flag = countryFlag(code);
  const name = countryName(code, locale);
  return flag ? `${flag} ${name}` : name;
}

/** Liste { code, flag, name } triée par nom localisé — pour alimenter un <select>. */
export function countryOptions(locale = "fr"): { code: string; flag: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, flag: countryFlag(code), name: countryName(code, locale) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}
