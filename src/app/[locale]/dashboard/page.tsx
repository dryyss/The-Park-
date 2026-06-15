import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getSellerDashboard } from "@/server/dashboard/dashboard.service";
import { PageHeader } from "@/components/common/page-header";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const viewer = await getViewerUser();
  if (!viewer) {
    return <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  const stats = await getSellerDashboard(viewer.id);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="ダッシュボード" />
      <div className="mt-8">
        <DashboardPanel stats={stats} />
      </div>
    </main>
  );
}
