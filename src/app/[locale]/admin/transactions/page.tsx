import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import {
  listAdminSales,
  listAdminExchanges,
  listAdminShipments,
  getTransactionsAdminStats,
} from "@/server/admin/transactions-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminTransactionsPanel } from "@/components/admin/admin-transactions-panel";
import type { ExchangeStatus, SaleStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    saleStatus?: string;
    exchangeStatus?: string;
    urgent?: string;
    q?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("transactions");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/transactions`)}`);
    notFound();
  }

  const tab = sp.tab ?? "sales";
  const urgentOnly = sp.urgent === "1";

  const [sales, exchanges, shipments, stats] = await Promise.all([
    listAdminSales({ status: sp.saleStatus as SaleStatus | undefined, q: sp.q }),
    listAdminExchanges({ status: sp.exchangeStatus as ExchangeStatus | undefined, q: sp.q }),
    listAdminShipments({ urgentOnly, q: sp.q }),
    getTransactionsAdminStats(),
  ]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("back")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("transactions.kicker")} title={t("transactions.title")} jp="取引" />
      </div>
      <div className="mt-8">
        <AdminTransactionsPanel
          tab={tab}
          sales={sales}
          exchanges={exchanges}
          shipments={shipments}
          stats={stats}
          saleStatus={sp.saleStatus ?? ""}
          exchangeStatus={sp.exchangeStatus ?? ""}
          urgentOnly={urgentOnly}
          query={sp.q ?? ""}
        />
      </div>
    </main>
  );
}
