import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getSellerDashboard, type DashboardStats } from "@/server/dashboard/dashboard.service";
import { PageHeader } from "@/components/common/page-header";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";

export const dynamic = "force-dynamic";

const EMPTY_DASHBOARD: DashboardStats = {
  activeListings: 0,
  totalViews: 0,
  pendingExchanges: 0,
  completedExchanges: 0,
  activeAuctions: 0,
  estimatedRevenue: "0,00 €",
  recentListings: [],
};

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;
  const stats = viewer ? await getSellerDashboard(viewer.id) : EMPTY_DASHBOARD;

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="ダッシュボード" />
      {!isAuthenticated && (
        <>
          <GuestAuthBanner messageKey="loginGateDashboard" />
          <p className="mt-3 text-[13px] font-bold text-texte-dim">{t("guestPreview")}</p>
        </>
      )}
      <div className="mt-8">
        <DashboardPanel stats={stats} readOnly={!isAuthenticated} />
      </div>
    </main>
  );
}
