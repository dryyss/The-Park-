/** Libellé catalogue par défaut — Saison 1 · Moteur Forgé. */
export const DEFAULT_FIRST_EDITION_LABEL = "1ère édition";

export const EDITION_PRESET_CODES = ["first", "unlimited", "custom"] as const;

export type EditionPresetCode = (typeof EDITION_PRESET_CODES)[number];

/** Détermine si un libellé correspond à une 1ère édition. */
export function isFirstEditionLabel(label: string | null | undefined): boolean {
  if (!label?.trim()) return false;
  const n = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    n.includes("1ere edition") ||
    n.includes("1re edition") ||
    n.includes("first edition") ||
    n === "1st" ||
    n.startsWith("1ere") ||
    n.startsWith("1re ")
  );
}

/** Libellé effectif : possession utilisateur > catalogue variante. */
export function resolveEditionLabel(
  userLabel: string | null | undefined,
  catalogLabel: string | null | undefined,
): string | null {
  const trimmed = userLabel?.trim();
  if (trimmed) return trimmed;
  const catalog = catalogLabel?.trim();
  return catalog || null;
}

export function editionPresetToLabel(
  preset: EditionPresetCode,
  custom?: string,
): string | null {
  if (preset === "first") return DEFAULT_FIRST_EDITION_LABEL;
  if (preset === "unlimited") return null;
  const c = custom?.trim();
  return c || null;
}
