import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminConversationThread } from "@/server/admin/messages-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminMessageThreadPanel } from "@/components/admin/admin-message-thread-panel";

export const dynamic = "force-dynamic";

export default async function AdminMessageThreadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("moderation");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/messages/${id}`)}`);
    notFound();
  }

  const thread = await getAdminConversationThread(id);
  if (!thread) notFound();

  return (
    <main className="page-section">
      <Link href="/admin/messages" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("messages.title")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("messages.kicker")} title={t("messages.threadTitle")} jp="メッセージ" />
      </div>
      <div className="mt-8">
        <AdminMessageThreadPanel thread={thread} />
      </div>
    </main>
  );
}
