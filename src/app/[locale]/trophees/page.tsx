import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerTrophies, getTrophyStats } from "@/server/trophy/trophy.service";
import { PageHeader } from "@/components/common/page-header";
import { TrophyGrid } from "@/components/trophies/trophy-grid";

export const dynamic = "force-dynamic";

export default async function TropheesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trophies");

  const viewer = await getViewerUser();
  if (!viewer) {
    return <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  const [badges, stats] = await Promise.all([getViewerTrophies(viewer.id), getTrophyStats(viewer.id)]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="トロフィー" />
      <div className="mt-8">
        <TrophyGrid badges={badges} unlocked={stats.unlocked} total={stats.total} pct={stats.pct} />
      </div>
    </main>
  );
}
