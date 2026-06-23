import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCatalogSummary, getCatalogStats, getFeaturedCards, getHeroCards } from "@/server/catalog/catalog.service";
import { getUserOwnedCountByRarity } from "@/server/collection/collection.service";
import { getCardsLikeMeta } from "@/server/card-like/card-like.service";
import { getRecentListings } from "@/server/marketplace/marketplace.service";
import { getTopCollectors, getRecentActivity } from "@/server/community/community.service";
import { getViewerUser } from "@/server/user/user.service";
import { rarityMeta } from "@/lib/rarity";
import { HeroSection } from "@/components/home/hero-section";
import { type RarityStripItem } from "@/components/home/rarity-strip";
import { RarityCarousel } from "@/components/home/rarity-carousel";
import { FeaturedCards } from "@/components/home/featured-cards";
import { SeasonBanner } from "@/components/home/season-banner";
import { LatestListings } from "@/components/home/latest-listings";
import { ActivityFeed } from "@/components/home/activity-feed";
import { TopCollectors } from "@/components/home/top-collectors";
import { localePageMetadata } from "@/lib/seo-messages";

// Catalogue en cache (unstable_cache 120 s) ; comptes membre lus live depuis Neon.
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

  const [stats, summary, heroCards, featured, listings, collectors, activity, viewer] = await Promise.all([
    getCatalogStats(),
    getCatalogSummary(),
    getHeroCards(),
    getFeaturedCards(8),
    getRecentListings(6),
    getTopCollectors(5),
    getRecentActivity(5),
    getViewerUser(),
  ]);

  const ownedByRarity = viewer ? await getUserOwnedCountByRarity(viewer.id) : null;
  const featuredSlice = featured.slice(3, 8);
  const likeMeta = Object.fromEntries(
    await getCardsLikeMeta(
      featuredSlice.map((c) => c.id),
      viewer?.id,
    ),
  );

  const rarities: RarityStripItem[] = summary.byRarity.map((r) => {
    const meta = rarityMeta(r.code);
    return {
      glyph: r.symbol ?? meta.glyph,
      label: r.label,
      count: ownedByRarity ? (ownedByRarity.get(r.code) ?? 0) : r.count,
      color: r.color ?? meta.color,
    };
  });

  return (
    <main className="overflow-x-hidden">
      {authError && tAuth && (
        <div className="border-b border-statut-danger/30 bg-statut-danger/10 px-4 py-3 text-center text-[13px] font-semibold text-statut-danger sm:px-6 lg:px-7">
          {tAuth("loginFailed", { code: authError })}
        </div>
      )}
      <HeroSection stats={stats} heroCards={heroCards} />

      <div className="page-container pb-[60px]">
        <RarityCarousel rarities={rarities} showOwned={!!viewer} />
        <FeaturedCards cards={featuredSlice} likeMeta={likeMeta} isAuthenticated={!!viewer} />
        <SeasonBanner />
        <LatestListings listings={listings} />

        <div className="animate-fade-up mt-[60px] grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.3fr_1fr]">
          <ActivityFeed items={activity} />
          <TopCollectors collectors={collectors} />
        </div>
      </div>
    </main>
  );
}
