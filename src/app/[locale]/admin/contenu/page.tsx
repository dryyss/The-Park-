import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listAdminPhotos, getContentAdminStats } from "@/server/admin/content-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminContentPanel } from "@/components/admin/admin-content-panel";

export const dynamic = "force-dynamic";

export default async function AdminContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("content");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/contenu`)}`);
    notFound();
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const [list, stats] = await Promise.all([
    listAdminPhotos({ q: sp.q, page }),
    getContentAdminStats(),
  ]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("back")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("content.kicker")} title={t("content.title")} jp="コンテンツ" />
      </div>
      <div className="mt-8">
        <AdminContentPanel
          rows={list.rows}
          total={list.total}
          page={list.page}
          pageSize={list.pageSize}
          stats={stats}
          query={sp.q ?? ""}
        />
      </div>
    </main>
  );
}
