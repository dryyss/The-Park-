import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAccessibleModules, resolveStaffRole } from "@/server/auth/permissions.service";
import { getAdminDashboardData, getAdminChartSeries } from "@/server/admin/overview.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminOverviewDashboard } from "@/components/admin/admin-overview-dashboard";
import { AdminOverviewCharts } from "@/components/admin/admin-overview-charts";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("overview");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin`)}`);
    notFound();
  }

  const modules = getAccessibleModules(access.user);
  const [data, chartSeries] = await Promise.all([
    getAdminDashboardData(modules),
    getAdminChartSeries(),
  ]);

  return (
    <main className="page-section">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="管理" />
      <div className="mt-8 space-y-10">
        <AdminOverviewCharts data={chartSeries} />
        <AdminOverviewDashboard data={data} modules={modules} staffRole={resolveStaffRole(access.user)} />
      </div>
    </main>
  );
}
