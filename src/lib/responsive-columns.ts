import type { CollectionGridCols } from "@/lib/collection-grid";

export type ColumnBreakpointConfig = {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

const BP = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

export function getColumnCount(width: number, config: ColumnBreakpointConfig): number {
  if (config.xl && width >= BP.xl) return config.xl;
  if (config.lg && width >= BP.lg) return config.lg;
  if (config.md && width >= BP.md) return config.md;
  if (config.sm && width >= BP.sm) return config.sm;
  return config.base;
}

export function columnConfigFromCollectionCols(cols: CollectionGridCols): ColumnBreakpointConfig {
  switch (cols) {
    case 3:
      return { base: 2, sm: 3 };
    case 5:
      return { base: 2, sm: 3, md: 4, lg: 5 };
    default:
      return { base: 2, sm: 3, md: 4 };
  }
}

export const MARKETPLACE_COLUMN_CONFIG: ColumnBreakpointConfig = {
  base: 2,
  sm: 3,
  lg: 4,
  xl: 5,
};

const COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

function colsClass(n: number): string {
  return COLS_CLASS[n] ?? COLS_CLASS[2];
}

export function gridClassFromColumnConfig(config: ColumnBreakpointConfig, gapClass = "gap-4.5"): string {
  const parts = ["grid", gapClass, colsClass(config.base)];
  if (config.sm) parts.push(`sm:${colsClass(config.sm)}`);
  if (config.md) parts.push(`md:${colsClass(config.md)}`);
  if (config.lg) parts.push(`lg:${colsClass(config.lg)}`);
  if (config.xl) parts.push(`xl:${colsClass(config.xl)}`);
  return parts.join(" ");
}
