import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getPlatformConfig } from "@/server/platform/platform.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminPlatformSettings } from "@/components/admin/admin-platform-settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.settings");

  const access = await requireModule("shop");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/reglages`)}`);
    notFound();
  }

  const config = await getPlatformConfig();

  return (
    <main className="mx-auto max-w-[900px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="設定" />
      <div className="mt-8">
        <AdminPlatformSettings config={config} />
      </div>
    </main>
  );
}
