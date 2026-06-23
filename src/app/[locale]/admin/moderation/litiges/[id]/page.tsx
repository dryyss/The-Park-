import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminDisputeDetail } from "@/server/admin/disputes-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminDisputeDetailPanel } from "@/components/admin/admin-dispute-detail-panel";

export const dynamic = "force-dynamic";

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("moderation");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/moderation/litiges/${id}`)}`);
    notFound();
  }

  const dispute = await getAdminDisputeDetail(id);
  if (!dispute) notFound();

  return (
    <main className="page-section">
      <Link href="/admin/moderation" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("moderation.title")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("disputes.kicker")} title={t("disputes.detailTitle")} jp="紛争" />
      </div>
      <div className="mt-8">
        <AdminDisputeDetailPanel dispute={dispute} />
      </div>
    </main>
  );
}
