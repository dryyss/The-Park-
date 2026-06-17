import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CollectionView } from "@/server/collection/collection.service";
import { buildCollectionHref, type CollectionUrlParams } from "@/lib/collection-grid";

export async function CompletionPanel({ data }: { data: CollectionView }) {
  const t = await getTranslations("collection");

  return (
    <div className="mt-7 grid overflow-hidden rounded-[18px] border border-charbon-500 bg-charbon-800 lg:grid-cols-[230px_1fr]">
      <div className="flex flex-col justify-center gap-1 border-charbon-500 p-6 lg:border-r [background:radial-gradient(circle_at_20%_15%,rgba(216,27,96,0.16),transparent_65%)]">
        <div className="font-display text-[54px] leading-none text-blanc-casse">
          {data.overallPct}
          <span className="text-[26px] text-carmin">%</span>
        </div>
        <div className="text-[14px] font-bold text-blanc-casse">{t("ownedCount", { count: data.overallOwned })}</div>
        <div className="text-[12px] text-texte-dim">{t("overallHint")}</div>
      </div>
      <div className="grid content-center gap-3.5 p-5 sm:grid-cols-2 lg:grid-cols-3 lg:px-6 lg:py-5">
        {data.rarityBars.map((b) => (
          <div key={b.code}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span style={{ color: b.color }}>{b.glyph}</span>
                <span className="text-[11.5px] font-extrabold tracking-[1.5px] text-texte-doux uppercase">{b.label}</span>
              </div>
              <span className="text-[11.5px] font-bold text-texte-dim">
                {b.owned}/{b.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-charbon-600">
              <div className="h-full rounded transition-all" style={{ width: `${b.pct}%`, background: b.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type CollParams = CollectionUrlParams;

export async function CollectionFiltersBar({
  params,
  counts,
  locale,
}: {
  params: CollParams;
  counts: CollectionView["counts"];
  locale: string;
}) {
  const t = await getTranslations("collection");

  const segs = [
    { k: "all" as const, label: t("segAll"), count: counts.all },
    { k: "owned" as const, label: t("segOwned"), count: counts.owned },
    { k: "missing" as const, label: t("segMissing"), count: counts.missing },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3.5">
      <div className="flex gap-0.5 rounded-[10px] border border-charbon-500 bg-charbon-800 p-1">
        {segs.map((s) => (
          <Link
            key={s.k}
            href={buildCollectionHref(params, { segment: s.k })}
            className={[
              "rounded-lg px-3.5 py-1.5 text-[12.5px] font-extrabold whitespace-nowrap transition",
              params.segment === s.k ? "bg-carmin text-white" : "text-texte-muet hover:text-blanc-casse",
            ].join(" ")}
          >
            {s.label} <span className="opacity-55">{s.count}</span>
          </Link>
        ))}
      </div>
      <form action={`/${locale}/collection`} className="ml-auto flex min-w-[200px] flex-1 justify-end">
        <input type="hidden" name="segment" value={params.segment} />
        {params.rarity && <input type="hidden" name="rarity" value={params.rarity} />}
        {params.cols && <input type="hidden" name="cols" value={params.cols} />}
        {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full max-w-[280px] rounded-full border border-charbon-500 bg-charbon-800 px-4.5 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
        />
      </form>
    </div>
  );
}
