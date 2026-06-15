import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminOrders } from "@/server/admin/admin.mutations";
import { PageHeader } from "@/components/common/page-header";
import { AdminOrdersPanel } from "@/components/admin/admin-orders-panel";

export const dynamic = "force-dynamic";

export default async function AdminCommandesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("shop");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/commandes`)}`);
    notFound();
  }

  const orders = await getAdminOrders();

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("orders.kicker")} title={t("orders.title")} jp="注文" />
      </div>
      <div className="mt-8">
        <AdminOrdersPanel orders={orders} />
      </div>
    </main>
  );
}
