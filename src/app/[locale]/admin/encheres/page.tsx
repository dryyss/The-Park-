import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listAdminAuctions, getAuctionsAdminStats } from "@/server/admin/auctions-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminAuctionsPanel } from "@/components/admin/admin-auctions-panel";
import type { AuctionStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminAuctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("auctions");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/encheres`)}`);
    notFound();
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const [list, stats] = await Promise.all([
    listAdminAuctions({
      q: sp.q,
      status: sp.status as AuctionStatus | undefined,
      page,
    }),
    getAuctionsAdminStats(),
  ]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("back")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("auctions.kicker")} title={t("auctions.title")} jp="オークション" />
      </div>
      <div className="mt-8">
        <AdminAuctionsPanel
          rows={list.rows}
          total={list.total}
          page={list.page}
          pageSize={list.pageSize}
          stats={stats}
          query={sp.q ?? ""}
          status={sp.status ?? ""}
        />
      </div>
    </main>
  );
}
