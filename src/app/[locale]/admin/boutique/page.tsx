import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminShopProducts } from "@/server/admin/admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminShopEditor } from "@/components/admin/admin-shop-editor";
import { AdminShopStats, AdminShopTable } from "@/components/admin/admin-shop-table";
import { AdminProductCreateForm } from "@/components/admin/admin-product-create-form";
import { AdminStorageBanner } from "@/components/admin/admin-storage-banner";
import { getAdminImageUploadMode } from "@/lib/admin-image-storage";

export const dynamic = "force-dynamic";

export default async function AdminBoutiquePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("shop");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/boutique`)}`);
    notFound();
  }

  const products = await getAdminShopProducts();
  const uploadMode = getAdminImageUploadMode();

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("shop.kicker")} title={t("shop.title")} jp="公式" />
      </div>
      <AdminStorageBanner uploadMode={uploadMode} />
      <AdminShopStats products={products} />
      <AdminShopTable products={products} />
      <div className="mt-8 space-y-4">
        <AdminProductCreateForm uploadMode={uploadMode} />
        <AdminShopEditor products={products} uploadMode={uploadMode} />
      </div>
    </main>
  );
}
