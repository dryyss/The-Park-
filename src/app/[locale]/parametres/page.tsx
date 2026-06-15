import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getUserNotificationPrefs } from "@/server/user/settings.service";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function ParametresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  const viewer = await requireAuthViewer(`/${locale}/parametres`);
  const prefs = await getUserNotificationPrefs(viewer.id);

  return (
    <main className="mx-auto max-w-[700px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="設定" />
      <div className="mt-8">
        <SettingsForm initialPrefs={prefs} />
      </div>
    </main>
  );
}
