"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  COLLECTION_SORT_OPTIONS,
  DEFAULT_COLLECTION_SORT,
  parseCollectionSort,
  type CollectionSort,
} from "@/lib/collection-sort";
import {
  COLLECTION_GRID_COLS,
  DEFAULT_COLLECTION_GRID_COLS,
  parseCollectionGridCols,
  type CollectionGridCols,
} from "@/lib/collection-grid";

function pushParams(
  pathname: string,
  searchParams: URLSearchParams,
  patch: { cols?: CollectionGridCols; sort?: CollectionSort },
) {
  const sp = new URLSearchParams(searchParams.toString());

  if (patch.cols !== undefined) {
    if (patch.cols === DEFAULT_COLLECTION_GRID_COLS) sp.delete("cols");
    else sp.set("cols", String(patch.cols));
  }

  if (patch.sort !== undefined) {
    if (patch.sort === DEFAULT_COLLECTION_SORT) sp.delete("sort");
    else sp.set("sort", patch.sort);
  }

  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function CollectionDisplayControls() {
  const t = useTranslations("collection");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cols = parseCollectionGridCols(searchParams.get("cols") ?? undefined);
  const sort = parseCollectionSort(searchParams.get("sort") ?? undefined);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="collection-sort" className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">
          {t("sortLabel")}
        </label>
        <select
          id="collection-sort"
          value={sort}
          onChange={(e) => router.push(pushParams(pathname, searchParams, { sort: parseCollectionSort(e.target.value) }))}
          className="cursor-pointer rounded-[10px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-bold text-blanc-casse outline-none focus:border-carmin"
        >
          {COLLECTION_SORT_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {t(`sort.${key}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("gridColsLabel")}</span>
        <div className="flex gap-0.5 rounded-[10px] border border-charbon-500 bg-charbon-800 p-1">
          {COLLECTION_GRID_COLS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => router.push(pushParams(pathname, searchParams, { cols: n }))}
              aria-label={t("gridColsPerRow", { count: n })}
              aria-pressed={cols === n}
              className={[
                "min-w-9 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold tabular-nums transition",
                cols === n ? "bg-charbon-600 text-blanc-casse" : "text-texte-muet hover:text-blanc-casse",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
