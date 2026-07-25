/** Libellé catalogue par défaut — Saison 1 · Moteur Forgé. */
export const DEFAULT_FIRST_EDITION_LABEL = "1ère édition";

export const EDITION_PRESET_CODES = ["first", "unlimited"] as const;

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

export function editionPresetToLabel(preset: EditionPresetCode): string | null {
  if (preset === "first") return DEFAULT_FIRST_EDITION_LABEL;
  return null;
}

/** Filtre d'édition tel qu'exposé par le classeur (`?edition=`). */
export type CollectionEdition = "first" | "reprint";

/** Traduit le filtre du classeur vers le preset stocké sur l'exemplaire. */
export function collectionEditionToPreset(edition: CollectionEdition | null): EditionPresetCode | null {
  if (edition === "first") return "first";
  if (edition === "reprint") return "unlimited";
  return null;
}

/**
 * Édition réelle d'un exemplaire possédé.
 *
 * Le preset posé sur la ligne fait foi ; à défaut, on retombe sur les libellés
 * (possession puis catalogue) — indispensable pour les exemplaires enregistrés
 * avant l'introduction de `editionPreset`, et pour les variantes dont le
 * catalogue porte déjà « 1ère édition ».
 */
export function effectiveEditionPreset(
  itemPreset: string | null | undefined,
  itemLabel: string | null | undefined,
  variantLabel: string | null | undefined,
): EditionPresetCode {
  if (itemPreset === "first") return "first";
  return isFirstEditionLabel(resolveEditionLabel(itemLabel, variantLabel)) ? "first" : "unlimited";
}
