import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCatalogSummary, getCatalogStats, getFeaturedCards, getHeroCards } from "@/server/catalog/catalog.service";
import { getCardsLikeMeta } from "@/server/card-like/card-like.service";
import { getRecentListings, getMostWantedForSale } from "@/server/marketplace/marketplace.service";
import { getActiveAuctions } from "@/server/auction/auction.service";
import { getTopCollectors, getRecentActivity } from "@/server/community/community.service";
import { getViewerUser } from "@/server/user/user.service";
import { RARITY_DEFINITIONS } from "@/lib/rarities";
import { HeroSection } from "@/components/home/hero-section";
import { type RarityStripItem } from "@/components/home/rarity-strip";
import { RarityCarousel } from "@/components/home/rarity-carousel";
import { HowToDominate } from "@/components/home/how-to-dominate";
import { FeaturedCards } from "@/components/home/featured-cards";
import { SeasonBanner } from "@/components/home/season-banner";
import { MarketTabs } from "@/components/home/market-tabs";
import { SpotlightSection } from "@/components/home/spotlight-section";
import { ActivityFeed } from "@/components/home/activity-feed";
import { TopCollectors } from "@/components/home/top-collectors";
import { PromoBannerStrip, PromoBannerRail } from "@/components/ads/promo-banners";
import { localePageMetadata } from "@/lib/seo-messages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localePageMetadata("home", locale, "");
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const { locale } = await params;
  const { auth_error: authError } = await searchParams;
  setRequestLocale(locale);
  const tAuth = authError ? await getTranslations("auth") : null;
  const t = await getTranslations("home");

  const [stats, summary, heroCards, featured, listings, auctions, collectors, activity, viewer, wantedCards] = await Promise.all([
    getCatalogStats(),
    getCatalogSummary(),
    getHeroCards(),
    getFeaturedCards(8),
    getRecentListings(6),
    getActiveAuctions(),
    getTopCollectors(5),
    getRecentActivity(8),
    getViewerUser(),
    getMostWantedForSale(3),
  ]);

  const featuredSlice = featured.slice(3, 8);
  const likeMeta = Object.fromEntries(
    await getCardsLikeMeta(
      featuredSlice.map((c) => c.id),
      viewer?.id,
    ),
  );

  const countByCode = new Map(summary.byRarity.map((r) => [r.code, r.count]));
  const rarities: RarityStripItem[] = RARITY_DEFINITIONS.map((def) => ({
    glyph: def.symbol,
    label: def.label,
    count: countByCode.get(def.code) ?? 0,
    color: def.color,
  }));

  return (
    <main className="overflow-x-hidden">
      {authError && tAuth && (
        <div className="border-b border-statut-danger/30 bg-statut-danger/10 px-4 py-3 text-center text-[13px] font-semibold text-statut-danger sm:px-6 lg:px-7">
          {tAuth("loginFailed", { code: authError })}
        </div>
      )}
      <HeroSection stats={stats} heroCards={heroCards} />

      <div className="page-container pb-[60px]">
        <PromoBannerStrip className="mt-6" />
        <RarityCarousel rarities={rarities} />
        <HowToDominate />
        <FeaturedCards cards={featuredSlice} likeMeta={likeMeta} isAuthenticated={!!viewer} />
        <SeasonBanner />
        <MarketTabs
          listings={listings}
          auctions={auctions}
          tabListings={t("marketTabListings")}
          tabAuctions={t("marketTabAuctions")}
          marketTitle={t("marketTitle")}
          marketJp={t("marketJp")}
          bidLabel={t("marketBidLabel")}
          noAuctions={t("marketNoAuctions")}
          seeAll={t("seeAllMarket")}
        />

        <SpotlightSection wantedCards={wantedCards} endingSoonAuctions={auctions} />

        <div className="animate-fade-up mt-[60px] grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.3fr_1fr]">
          <ActivityFeed items={activity} />
          <div className="flex flex-col gap-[18px]">
            <TopCollectors collectors={collectors} />
            <PromoBannerRail />
          </div>
        </div>
      </div>
    </main>
  );
}
