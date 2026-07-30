import type { CollectionGridCols } from "@/lib/collection-grid";

export type ColumnBreakpointConfig = {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  "2xl"?: number;
  "3xl"?: number;
};

/** Doit rester aligné sur les breakpoints Tailwind (cf. `--breakpoint-*`). */
const BP = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536, "3xl": 1920 } as const;

/** Du plus large au plus étroit : le premier palier atteint gagne. */
const TIERS = ["3xl", "2xl", "xl", "lg", "md", "sm"] as const;

/**
 * Nombre de colonnes pour une largeur de **viewport**.
 * Impérativement le viewport et non la largeur du conteneur : les classes
 * `sm:`/`lg:`… posées sur la grille sont évaluées par des media queries, donc
 * sur le viewport. Mesurer le conteneur désynchronisait le découpage en lignes
 * de ce que le CSS affichait réellement.
 */
export function getColumnCount(width: number, config: ColumnBreakpointConfig): number {
  for (const tier of TIERS) {
    const cols = config[tier];
    if (cols && width >= BP[tier]) return cols;
  }
  return config.base;
}

export function columnConfigFromCollectionCols(cols: CollectionGridCols): ColumnBreakpointConfig {
  switch (cols) {
    case 3:
      return { base: 2, sm: 3, "2xl": 4, "3xl": 5 };
    case 5:
      return { base: 2, sm: 3, md: 4, lg: 5, "2xl": 6, "3xl": 7 };
    default:
      return { base: 2, sm: 3, md: 4, "2xl": 5, "3xl": 6 };
  }
}

export const MARKETPLACE_COLUMN_CONFIG: ColumnBreakpointConfig = {
  base: 2,
  sm: 3,
  lg: 4,
  xl: 5,
  "2xl": 6,
  "3xl": 7,
};

/*
  Classes littérales : Tailwind scanne le source, une interpolation
  `grid-cols-${n}` ne serait jamais générée.
*/
const COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
};

const PREFIXED_COLS_CLASS: Record<(typeof TIERS)[number], Record<number, string>> = {
  sm: { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" },
  md: { 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6" },
  lg: { 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" },
  xl: { 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6", 7: "xl:grid-cols-7" },
  "2xl": { 4: "2xl:grid-cols-4", 5: "2xl:grid-cols-5", 6: "2xl:grid-cols-6", 7: "2xl:grid-cols-7" },
  "3xl": { 5: "3xl:grid-cols-5", 6: "3xl:grid-cols-6", 7: "3xl:grid-cols-7", 8: "3xl:grid-cols-8" },
};

function colsClass(n: number): string {
  return COLS_CLASS[n] ?? COLS_CLASS[2];
}

export function gridClassFromColumnConfig(config: ColumnBreakpointConfig, gapClass = "gap-4.5"): string {
  const parts = ["grid", gapClass, colsClass(config.base)];
  // Du plus étroit au plus large, pour que la cascade CSS reste lisible.
  for (const tier of [...TIERS].reverse()) {
    const cols = config[tier];
    if (!cols) continue;
    const cls = PREFIXED_COLS_CLASS[tier][cols];
    if (cls) parts.push(cls);
  }
  return parts.join(" ");
}
