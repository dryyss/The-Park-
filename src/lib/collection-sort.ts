import type { CollectionCard } from "@/server/collection/collection.service";

export const COLLECTION_SORT_OPTIONS = [
  "number",
  "number-desc",
  "name",
  "name-desc",
  "owned-first",
  "missing-first",
  "quantity-desc",
  "quantity-asc",
] as const;

export type CollectionSort = (typeof COLLECTION_SORT_OPTIONS)[number];

export const DEFAULT_COLLECTION_SORT: CollectionSort = "number";

export function parseCollectionSort(value?: string): CollectionSort {
  if (value && (COLLECTION_SORT_OPTIONS as readonly string[]).includes(value)) {
    return value as CollectionSort;
  }
  return DEFAULT_COLLECTION_SORT;
}

export function sortCollectionCards(cards: CollectionCard[], sort: CollectionSort): CollectionCard[] {
  const list = [...cards];

  switch (sort) {
    case "number-desc":
      return list.sort((a, b) => b.number - a.number);
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    case "name-desc":
      return list.sort((a, b) => b.name.localeCompare(a.name, "fr"));
    case "owned-first":
      return list.sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? -1 : 1;
        return a.number - b.number;
      });
    case "missing-first":
      return list.sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? 1 : -1;
        return a.number - b.number;
      });
    case "quantity-desc":
      return list.sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.number - b.number;
      });
    case "quantity-asc":
      return list.sort((a, b) => {
        if (a.quantity !== b.quantity) return a.quantity - b.quantity;
        return a.number - b.number;
      });
    default:
      return list.sort((a, b) => a.number - b.number);
  }
}
