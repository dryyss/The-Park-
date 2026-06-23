import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getCatalogSummary, getSeasonCards } from "@/server/catalog/catalog.service";
import { getViewerUser } from "@/server/user/user.service";
import { HORS_SERIE_SEASON_CODE } from "@/lib/seasons";
import { rarityMeta } from "@/lib/rarity";
import { PageHeader } from "@/components/common/page-header";
import { type RarityStripItem } from "@/components/home/rarity-strip";
import { RarityCarousel } from "@/components/home/rarity-carousel";
import { SeasonCardTile } from "@/components/season/season-card-tile";
import { localePageMetadata } from "@/lib/seo-messages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localePageMetadata("horsSerie", locale, "/hors-serie");
}

export default async function HorsSeriePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("season");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;
  const [summary, cardsWithQty] = await Promise.all([
    getCatalogSummary(HORS_SERIE_SEASON_CODE),
    getSeasonCards(HORS_SERIE_SEASON_CODE, viewer?.id),
  ]);

  const rarities: RarityStripItem[] = summary.byRarity.map((r) => {
    const meta = rarityMeta(r.code);
    return { glyph: r.symbol ?? meta.glyph, label: r.label, count: r.count, color: r.color ?? meta.color };
  });

  return (
    <main className="page-section">
      <PageHeader kicker={t("horsSerieKicker")} title={summary.season?.name ?? t("horsSerieTitle")} jp="外伝">
        <Link href="/collection" className="font-display -skew-x-3 rounded-[10px] bg-or px-5 py-3 text-[13px] tracking-[1.5px] text-charbon uppercase">
          {t("trackCompletion")}
        </Link>
      </PageHeader>

      <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-texte-corps">{t("horsSerieDesc")}</p>

      {cardsWithQty.length === 0 ? (
        <p className="mt-10 text-center text-[14px] font-bold text-texte-dim">{t("horsSerieEmpty")}</p>
      ) : (
        <>
          <div className="mt-8">
            <RarityCarousel rarities={rarities} />
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cardsWithQty.map((c) => (
              <SeasonCardTile key={c.slug} card={c} isAuthenticated={isAuthenticated} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
