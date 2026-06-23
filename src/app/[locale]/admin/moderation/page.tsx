import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listOpenDisputes, listPendingReports } from "@/server/moderation/moderation.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminModerationPanel } from "@/components/admin/admin-moderation-panel";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("moderation");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/moderation`)}`);
    notFound();
  }

  const [reports, disputes] = await Promise.all([listPendingReports(), listOpenDisputes()]);

  return (
    <main className="page-section">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("moderation.kicker")} title={t("moderation.title")} jp="モデレーション" />
      </div>
      <div className="mt-8">
        <AdminModerationPanel reports={reports} disputes={disputes} />
      </div>
    </main>
  );
}
