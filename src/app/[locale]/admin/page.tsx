import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAccessibleModules, resolveStaffRole } from "@/server/auth/permissions.service";
import { getAdminOverview } from "@/server/admin/admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminOverviewPanel } from "@/components/admin/admin-sections";

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

  const overview = await getAdminOverview();
  const modules = getAccessibleModules(access.user);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="管理" />
      <div className="mt-8">
        <AdminOverviewPanel overview={overview} modules={modules} staffRole={resolveStaffRole(access.user)} />
      </div>
    </main>
  );
}
