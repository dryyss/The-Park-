import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCatalogSummary, getSeasonCards } from "@/server/catalog/catalog.service";
import { rarityMeta } from "@/lib/rarity";
import { PageHeader } from "@/components/common/page-header";
import { RarityStrip, type RarityStripItem } from "@/components/home/rarity-strip";
import { HoloCard } from "@/components/cards/holo-card";

export const dynamic = "force-dynamic";

export default async function Saison1Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("season");

  const [summary, cards] = await Promise.all([getCatalogSummary(), getSeasonCards("S01")]);

  const rarities: RarityStripItem[] = summary.byRarity.map((r) => {
    const meta = rarityMeta(r.code);
    return { glyph: r.symbol ?? meta.glyph, label: r.label, count: r.count, color: r.color ?? meta.color };
  });

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={summary.season?.name ?? t("title")} jp="シーズン1">
        <Link href="/collection" className="font-display -skew-x-3 rounded-[10px] bg-carmin px-5 py-3 text-[13px] tracking-[1.5px] text-white uppercase">
          {t("trackCompletion")}
        </Link>
      </PageHeader>

      <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-texte-corps">{t("desc")}</p>

      <div className="mt-8">
        <RarityStrip rarities={rarities} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.slug} href={`/carte/${c.slug}`}>
            <HoloCard src={c.image} alt={c.name} tilt={c.tilt} holo={c.holo} variant={c.variant} />
            <div className="mt-2 flex items-center justify-between px-0.5">
              <span className="truncate text-[10.5px] font-extrabold text-texte-doux">{c.name}</span>
              <span style={{ color: c.color }}>{c.glyph}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
