/**
 * Constantes & validation partagées du Showroom (classeurs curatés).
 * Source unique de vérité pour les bornes de grille — utilisée côté serveur (gardes)
 * ET côté client (UI). Ne jamais faire confiance au client : tout est revérifié serveur.
 */

/** Bornes de la grille d'une page de classeur. */
export const SHOWCASE_MIN_COLS = 2;
export const SHOWCASE_MAX_COLS = 4;
export const SHOWCASE_MIN_ROWS = 2;
export const SHOWCASE_MAX_ROWS = 4;

/** Bornes du nombre de pages d'un classeur. */
export const SHOWCASE_MIN_PAGES = 1;
export const SHOWCASE_MAX_PAGES = 12;

/** Nombre maximum de classeurs par membre (option multi-classeurs). */
export const SHOWCASE_MAX_BINDERS = 10;

/** Longueur max du titre d'un classeur. */
export const SHOWCASE_TITLE_MAX = 40;

/**
 * Presets de grille proposés dans l'UI (comme les tailles de classeur Pokémon Pocket).
 * `slots` = cols × rows = nombre d'emplacements par page.
 */
export const SHOWCASE_GRID_PRESETS = [
  { cols: 2, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 3, rows: 3 },
  { cols: 3, rows: 4 },
  { cols: 4, rows: 3 },
  { cols: 4, rows: 4 },
] as const;

/** Nombre d'emplacements d'une page pour une grille donnée. */
export function slotsPerPage(cols: number, rows: number): number {
  return cols * rows;
}

/** Borne une valeur entière dans [min, max]. */
export function clampInt(value: number, min: number, max: number): number {
  const n = Math.trunc(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, n));
}

/** true si (cols, rows) est une grille autorisée. */
export function isValidGrid(cols: number, rows: number): boolean {
  return (
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    cols >= SHOWCASE_MIN_COLS &&
    cols <= SHOWCASE_MAX_COLS &&
    rows >= SHOWCASE_MIN_ROWS &&
    rows <= SHOWCASE_MAX_ROWS
  );
}

/** Normalise une config de classeur reçue du client vers des valeurs sûres. */
export function normalizeShowcaseConfig(input: {
  cols?: number;
  rows?: number;
  pageCount?: number;
}): { cols: number; rows: number; pageCount: number } {
  return {
    cols: clampInt(input.cols ?? 3, SHOWCASE_MIN_COLS, SHOWCASE_MAX_COLS),
    rows: clampInt(input.rows ?? 3, SHOWCASE_MIN_ROWS, SHOWCASE_MAX_ROWS),
    pageCount: clampInt(input.pageCount ?? 1, SHOWCASE_MIN_PAGES, SHOWCASE_MAX_PAGES),
  };
}

/** true si (page, slot) tient dans une grille cols×rows sur pageCount pages. */
export function isSlotInBounds(
  page: number,
  slot: number,
  cols: number,
  rows: number,
  pageCount: number,
): boolean {
  return (
    Number.isInteger(page) &&
    Number.isInteger(slot) &&
    page >= 0 &&
    page < pageCount &&
    slot >= 0 &&
    slot < slotsPerPage(cols, rows)
  );
}
