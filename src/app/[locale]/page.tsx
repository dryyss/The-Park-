import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCatalogSummary, getCatalogStats, getFeaturedCards, getHeroCards } from "@/server/catalog/catalog.service";
import { getUserOwnedCountByRarity } from "@/server/collection/collection.service";
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

// Données catalogue mises en cache côté serveur (120 s) — évite un aller-retour Neon à chaque navigation.
export const revalidate = 60;

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
        <div className="border-b border-statut-danger/30 bg-statut-danger/10 px-7 py-3 text-center text-[13px] font-semibold text-statut-danger">
          {tAuth("loginFailed", { code: authError })}
        </div>
      )}
      <HeroSection stats={stats} heroCards={heroCards} />

      <div className="mx-auto max-w-[1320px] px-7 pb-[60px]">
        <RarityCarousel rarities={rarities} showOwned={!!viewer} />
        <FeaturedCards cards={featured.slice(3, 8)} />
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
