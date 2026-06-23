import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getUserNotificationPrefs } from "@/server/user/settings.service";
import { getAccountSettings } from "@/server/user/account.service";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { AccountSecuritySection } from "@/components/settings/account-security-section";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function ParametresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  const viewer = await requireAuthViewer(`/${locale}/parametres`);
  const [prefs, account] = await Promise.all([
    getUserNotificationPrefs(viewer.id),
    getAccountSettings(viewer.id),
  ]);

  if (!account) return null;

  return (
    <main className="mx-auto max-w-[1080px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="設定" />
      <div className="mt-8">
        <SettingsForm
          initialPrefs={prefs}
          displayName={account.displayName}
          bio={account.bio}
          slug={account.slug}
          city={account.city}
          addresses={account.addresses}
          securitySection={
            <AccountSecuritySection email={account.email} passwordResetUrl={account.passwordResetUrl} />
          }
        />
      </div>
    </main>
  );
}
