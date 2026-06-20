import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listStockProducts, listStockMovements, getStockStats } from "@/server/admin/stocks.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminStocksPanel } from "@/components/admin/admin-stocks-panel";

export const dynamic = "force-dynamic";

export default async function AdminStocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("stocks");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED")
      redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/stocks`)}`);
    notFound();
  }

  const tab = (sp.tab === "movements" ? "movements" : "products") as "products" | "movements";

  const [products, movements, stats] = await Promise.all([
    listStockProducts(),
    listStockMovements(),
    getStockStats(),
  ]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("stocks.kicker")} title={t("stocks.title")} jp="在庫管理" />
      </div>
      <div className="mt-8">
        <AdminStocksPanel products={products} movements={movements} stats={stats} tab={tab} />
      </div>
    </main>
  );
}
