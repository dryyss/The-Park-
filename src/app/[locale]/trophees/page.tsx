import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getViewerUser } from "@/server/user/user.service";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";
import { getViewerTrophies, getTrophyStats, getCatalogTrophies, getCatalogTrophyStats } from "@/server/trophy/trophy.service";
import { PageHeader } from "@/components/common/page-header";
import { TrophyGrid } from "@/components/trophies/trophy-grid";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { localePageMetadata } from "@/lib/seo-messages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localePageMetadata("trophees", locale, "/trophees");
}

export default async function TropheesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trophies");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;

  const [badges, stats] = isAuthenticated
    ? await (async () => {
        await evaluateUserBadgesSafe(viewer.id);
        return Promise.all([getViewerTrophies(viewer.id), getTrophyStats(viewer.id)]);
      })()
    : await Promise.all([getCatalogTrophies(), getCatalogTrophyStats()]);

  return (
    <main className="page-section">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="トロフィー" />
      {!isAuthenticated && <GuestAuthBanner messageKey="loginGateTrophies" />}
      <div className="mt-8">
        <TrophyGrid badges={badges} unlocked={stats.unlocked} total={stats.total} pct={stats.pct} />
      </div>
    </main>
  );
}
