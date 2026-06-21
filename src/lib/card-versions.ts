/** Définitions des types de version Pocket Drifterz (paramétrables admin). */
export const VERSION_TYPE_DEFINITIONS = [
  { code: "standard", label: "Standard", isFoil: false, sortOrder: 0 },
  { code: "unique", label: "Unique", isFoil: false, sortOrder: 1 },
  { code: "promotional", label: "Promotionnelle", isFoil: false, sortOrder: 2 },
  { code: "special", label: "Spécial", isFoil: false, sortOrder: 3 },
  { code: "collaboration", label: "Collaboration", isFoil: false, sortOrder: 4 },
  { code: "signed", label: "Signé", isFoil: false, sortOrder: 5 },
] as const;

export const ACTIVE_VERSION_CODES = VERSION_TYPE_DEFINITIONS.map((v) => v.code);

export type ActiveVersionCode = (typeof VERSION_TYPE_DEFINITIONS)[number]["code"];

export function isActiveVersionCode(code: string): code is ActiveVersionCode {
  return (ACTIVE_VERSION_CODES as readonly string[]).includes(code);
}

/** Libellé produit d'un type de version (catalogue FR). */
export function versionTypeLabel(code: string): string {
  return VERSION_TYPE_DEFINITIONS.find((v) => v.code === code)?.label ?? code;
}
