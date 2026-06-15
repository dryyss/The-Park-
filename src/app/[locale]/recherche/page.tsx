import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchCards } from "@/server/catalog/catalog.service";
import { PageHeader } from "@/components/common/page-header";
import { HoloCard } from "@/components/cards/holo-card";

export const dynamic = "force-dynamic";

export default async function RecherchePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");
  const q = sp.q?.trim() ?? "";
  const results = q ? await searchCards(q) : [];

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="検索" />

      <form action={`/${locale}/recherche`} className="mt-6">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="w-full max-w-[560px] rounded-full border border-charbon-500 bg-charbon-800 px-5 py-3.5 text-[15px] text-blanc-casse outline-none focus:border-carmin"
        />
      </form>

      {q && (
        <p className="mt-4 text-[13px] font-bold text-texte-dim">
          {results.length > 0 ? t("resultCount", { count: results.length, q }) : t("noResults", { q })}
        </p>
      )}

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
    </main>
  );
}
