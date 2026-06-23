import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminOrderStats, listAdminOrders } from "@/server/admin/orders.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminOrdersPanel } from "@/components/admin/admin-orders-panel";
import type { OrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PERIOD_VALUES = ["today", "week", "month"];

export default async function AdminCommandesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; period?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("shop");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/commandes`)}`);
    notFound();
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const status = sp.status && STATUS_VALUES.includes(sp.status) ? (sp.status as OrderStatus) : undefined;
  const period = sp.period && PERIOD_VALUES.includes(sp.period) ? (sp.period as "today" | "week" | "month") : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [result, stats] = await Promise.all([
    listAdminOrders({ q, status, period, page }),
    getAdminOrderStats(),
  ]);

  return (
    <main className="page-section">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("orders.kicker")} title={t("orders.title")} jp="注文" />
      </div>
      <div className="mt-8">
        <AdminOrdersPanel
          result={result}
          stats={stats}
          query={q}
          status={status ?? ""}
          period={period ?? ""}
        />
      </div>
    </main>
  );
}
