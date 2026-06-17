import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchCards, getCatalogFacets, type SearchSort } from "@/server/catalog/catalog.service";
import { rarityMeta } from "@/lib/rarity";
import { buildHref } from "@/lib/query";
import { PageHeader } from "@/components/common/page-header";
import { HoloCard } from "@/components/cards/holo-card";
import { FilterChipGroup } from "@/components/filters/filter-chip";
import { SortSelect } from "@/components/filters/sort-select";

export const dynamic = "force-dynamic";

const SORTS: SearchSort[] = ["number", "name", "rarity"];
const PATHNAME = "/recherche";

export default async function RecherchePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; rarity?: string; version?: string; sort?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");

  const q = sp.q?.trim() ?? "";
  const rarity = sp.rarity || undefined;
  const version = sp.version || undefined;
  const sort: SearchSort = SORTS.includes(sp.sort as SearchSort) ? (sp.sort as SearchSort) : "number";

  const [facets, results] = await Promise.all([
    getCatalogFacets(),
    searchCards({ q, rarity, version, sort }),
  ]);

  const hasQuery = !!(q || rarity || version);
  const hasFilters = !!(rarity || version || sort !== "number");
  // Paramètres courants propagés aux chips / tri (on omet le tri par défaut).
  const current = { q: q || undefined, rarity, version, sort: sort !== "number" ? sort : undefined };

  const rarityOptions = facets.rarities.map((r) => {
    const meta = rarityMeta(r.code);
    return { value: r.code, label: r.label, glyph: meta.glyph, glyphColor: meta.color, count: r.count };
  });
  const versionOptions = facets.versions.map((v) => ({ value: v.code, label: v.label }));

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="検索" />

      <form action={`/${locale}/recherche`} className="mt-6">
        {rarity && <input type="hidden" name="rarity" value={rarity} />}
        {version && <input type="hidden" name="version" value={version} />}
        {sort !== "number" && <input type="hidden" name="sort" value={sort} />}
        <input
          name="q"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="w-full max-w-[560px] rounded-full border border-charbon-500 bg-charbon-800 px-5 py-3.5 text-[15px] text-blanc-casse outline-none focus:border-carmin"
        />
      </form>

      <div className="mt-5 flex flex-col gap-2.5">
        <FilterChipGroup
          label={t("filterRarity")}
          paramKey="rarity"
          allLabel={t("allRarities")}
          options={rarityOptions}
          current={rarity}
          pathname={PATHNAME}
          params={current}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <FilterChipGroup
            label={t("filterVersion")}
            paramKey="version"
            allLabel={t("allVersions")}
            options={versionOptions}
            current={version}
            pathname={PATHNAME}
            params={current}
          />
          <div className="ml-auto flex items-center gap-4">
            {hasFilters && (
              <Link
                href={buildHref(PATHNAME, {}, { q: q || undefined })}
                className="text-[11.5px] font-bold text-carmin transition hover:underline"
              >
                {t("clearFilters")}
              </Link>
            )}
            <SortSelect
              label={t("sortLabel")}
              value={sort}
              options={[
                { value: "number", label: t("sortNumber") },
                { value: "name", label: t("sortName") },
                { value: "rarity", label: t("sortRarity") },
              ]}
              params={current}
            />
          </div>
        </div>
      </div>

      {hasQuery ? (
        <>
          <p className="mt-5 text-[13px] font-bold text-texte-dim">
            {results.length === 0
              ? q
                ? t("noResults", { q })
                : t("noResultsFiltered")
              : q
                ? t("resultCount", { count: results.length, q })
                : t("resultCountFiltered", { count: results.length })}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((c) => (
              <Link key={c.slug} href={`/carte/${c.slug}`}>
                <HoloCard src={c.image} alt={c.name} tilt={5} holo={0.5} variant="rainbow" />
                <div className="mt-2 truncate text-[11px] font-extrabold text-texte-doux">{c.name}</div>
                <div className="text-[10px] font-bold text-texte-dim">
                  <span style={{ color: c.color }}>{c.glyph}</span> {c.rarityLabel}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-10 rounded-[18px] border border-dashed border-charbon-500 bg-charbon-800/50 py-16 text-center">
          <p className="mx-auto max-w-[420px] text-[14px] font-bold text-texte-dim">{t("browsePrompt")}</p>
        </div>
      )}
    </main>
  );
}
