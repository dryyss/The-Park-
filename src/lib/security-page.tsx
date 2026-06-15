import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getDemoExchangeForSecurity } from "@/server/messaging/conversation.service";
import { PageHeader } from "@/components/common/page-header";
import { SecurityPageLayout } from "@/components/security/security-page-layout";

export const dynamic = "force-dynamic";

type SecurityPageKey = "garantie" | "option-envoi" | "envoi" | "deballage" | "echange" | "etats" | "litige";

export async function renderSecurityPage(params: Promise<{ locale: string }>, pageKey: SecurityPageKey) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("security");

  const viewer = await getViewerUser();
  if (!viewer) {
    return <main className="mx-auto max-w-[900px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  const exchange = await getDemoExchangeForSecurity(viewer.id);

  return (
    <main className="mx-auto max-w-[900px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="安全" />
      <div className="mt-8">
        <SecurityPageLayout pageKey={pageKey} exchange={exchange} />
      </div>
    </main>
  );
}
