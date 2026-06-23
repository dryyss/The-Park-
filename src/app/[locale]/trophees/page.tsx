import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";
import { getViewerTrophies, getTrophyStats, getCatalogTrophies, getCatalogTrophyStats } from "@/server/trophy/trophy.service";
import { PageHeader } from "@/components/common/page-header";
import { TrophyGrid } from "@/components/trophies/trophy-grid";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="トロフィー" />
      {!isAuthenticated && <GuestAuthBanner messageKey="loginGateTrophies" />}
      <div className="mt-8">
        <TrophyGrid badges={badges} unlocked={stats.unlocked} total={stats.total} pct={stats.pct} />
      </div>
    </main>
  );
}
