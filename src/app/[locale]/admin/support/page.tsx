import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getSupportOverview } from "@/server/admin/support.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminSupportPanel } from "@/components/admin/admin-support-panel";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("support");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/support`)}`);
    notFound();
  }

  const overview = await getSupportOverview();

  return (
    <>
      <PageHeader kicker={t("support.kicker")} title={t("support.title")} jp="サポート" />
      <div className="mt-8">
        <AdminSupportPanel overview={overview} />
      </div>
    </>
  );
}
