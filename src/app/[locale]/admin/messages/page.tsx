import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listAdminConversations, getMessagesAdminStats } from "@/server/admin/messages-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminMessagesPanel } from "@/components/admin/admin-messages-panel";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; flagged?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("moderation");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/messages`)}`);
    notFound();
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const flaggedOnly = sp.flagged === "1";

  const [result, stats] = await Promise.all([
    listAdminConversations({ q: sp.q, flaggedOnly, page }),
    getMessagesAdminStats(),
  ]);

  return (
    <main className="page-section">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("back")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("messages.kicker")} title={t("messages.title")} jp="メッセージ" />
      </div>
      <div className="mt-8">
        <AdminMessagesPanel result={result} stats={stats} query={sp.q ?? ""} flaggedOnly={flaggedOnly} />
      </div>
    </main>
  );
}
