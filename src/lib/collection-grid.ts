import {
  DEFAULT_COLLECTION_SORT,
  parseCollectionSort,
  type CollectionSort,
} from "@/lib/collection-sort";

/** Nombre de cartes par ligne (classeur). */
export const COLLECTION_GRID_COLS = [3, 4, 5] as const;

export type CollectionGridCols = (typeof COLLECTION_GRID_COLS)[number];

export const DEFAULT_COLLECTION_GRID_COLS: CollectionGridCols = 4;

export function parseCollectionGridCols(value?: string): CollectionGridCols {
  const n = parseInt(value ?? "", 10);
  if (n === 3 || n === 4 || n === 5) return n;
  return DEFAULT_COLLECTION_GRID_COLS;
}

export interface CollectionUrlParams {
  segment: "all" | "owned" | "missing";
  rarity?: string;
  q?: string;
  cols?: CollectionGridCols;
  sort?: CollectionSort;
  season?: string;
  /** Code de collection (`?set=`). Conservé au changement de segment ou de tri. */
  set?: string;
}

export function buildCollectionHref(params: CollectionUrlParams, patch: Partial<CollectionUrlParams> = {}): string {
  const merged = { ...params, ...patch };
  const sp = new URLSearchParams();
  if (merged.segment !== "all") sp.set("segment", merged.segment);
  if (merged.rarity) sp.set("rarity", merged.rarity);
  if (merged.q) sp.set("q", merged.q);
  if (merged.cols && merged.cols !== DEFAULT_COLLECTION_GRID_COLS) sp.set("cols", String(merged.cols));
  if (merged.sort && merged.sort !== DEFAULT_COLLECTION_SORT) sp.set("sort", merged.sort);
  if (merged.season) sp.set("season", merged.season);
  if (merged.set) sp.set("set", merged.set);
  const qs = sp.toString();
  return `/collection${qs ? `?${qs}` : ""}`;
}

export { parseCollectionSort, DEFAULT_COLLECTION_SORT, type CollectionSort };
