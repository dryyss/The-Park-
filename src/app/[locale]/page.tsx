import { setRequestLocale } from "next-intl/server";
import { getCatalogSummary, getCatalogStats, getFeaturedCards } from "@/server/catalog/catalog.service";
import { getRecentListings } from "@/server/marketplace/marketplace.service";
import { getTopCollectors, getRecentActivity } from "@/server/community/community.service";
import { rarityMeta } from "@/lib/rarity";
import { HeroSection } from "@/components/home/hero-section";
import { RarityStrip, type RarityStripItem } from "@/components/home/rarity-strip";
import { FeaturedCards } from "@/components/home/featured-cards";
import { SeasonBanner } from "@/components/home/season-banner";
import { LatestListings } from "@/components/home/latest-listings";
import { ActivityFeed } from "@/components/home/activity-feed";
import { TopCollectors } from "@/components/home/top-collectors";

// Données catalogue mises en cache côté serveur (120 s) — évite un aller-retour Neon à chaque navigation.
export const revalidate = 60;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [stats, summary, featured, listings, collectors, activity] = await Promise.all([
    getCatalogStats(),
    getCatalogSummary(),
    getFeaturedCards(8),
    getRecentListings(6),
    getTopCollectors(5),
    getRecentActivity(5),
  ]);

  const rarities: RarityStripItem[] = summary.byRarity.map((r) => {
    const meta = rarityMeta(r.code);
    return { glyph: r.symbol ?? meta.glyph, label: r.label, count: r.count, color: r.color ?? meta.color };
  });

  return (
    <main className="overflow-x-hidden">
      <HeroSection stats={stats} heroCards={featured.slice(0, 3)} />

      <div className="mx-auto max-w-[1320px] px-7 pb-[60px]">
        <RarityStrip rarities={rarities} />
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
