import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCatalogSummary, getSeasonCards } from "@/server/catalog/catalog.service";
import { getViewerUser } from "@/server/user/user.service";
import { rarityMeta } from "@/lib/rarity";
import { PageHeader } from "@/components/common/page-header";
import { type RarityStripItem } from "@/components/home/rarity-strip";
import { RarityCarousel } from "@/components/home/rarity-carousel";
import { SeasonCardTile } from "@/components/season/season-card-tile";

export const dynamic = "force-dynamic";

export default async function Saison1Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("season");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;
  const [summary, cardsWithQty] = await Promise.all([
    getCatalogSummary(),
    getSeasonCards("S01", viewer?.id),
  ]);

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
        <RarityCarousel rarities={rarities} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cardsWithQty.map((c) => (
          <SeasonCardTile key={c.slug} card={c} isAuthenticated={isAuthenticated} />
        ))}
      </div>
    </main>
  );
}
