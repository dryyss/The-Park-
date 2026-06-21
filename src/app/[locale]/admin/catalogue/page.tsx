import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminCatalog, getAdminRarities, getAdminVersionTypes } from "@/server/admin/admin.mutations";
import { PageHeader } from "@/components/common/page-header";
import { AdminCatalogManager } from "@/components/admin/admin-catalog-manager";
import { AdminStorageBanner } from "@/components/admin/admin-storage-banner";
import { getAdminImageUploadMode } from "@/lib/admin-image-storage";

export const dynamic = "force-dynamic";

export default async function AdminCataloguePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("catalog");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/catalogue`)}`);
    notFound();
  }

  const [seasons, rarities, versionTypes] = await Promise.all([
    getAdminCatalog(),
    getAdminRarities(),
    getAdminVersionTypes(),
  ]);
  const uploadMode = getAdminImageUploadMode();

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("catalog.kicker")} title={t("catalog.title")} jp="カタログ" />
      </div>
      <AdminStorageBanner uploadMode={uploadMode} />
      <div className="mt-8">
        <AdminCatalogManager seasons={seasons} rarities={rarities} versionTypes={versionTypes} uploadMode={uploadMode} />
      </div>
    </main>
  );
}
