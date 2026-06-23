import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getSecurityContext } from "@/server/c2c/security.service";
import { PageHeader } from "@/components/common/page-header";
import { SecurityPageLayout } from "@/components/security/security-page-layout";

export const dynamic = "force-dynamic";

type SecurityPageKey = "garantie" | "option-envoi" | "envoi" | "deballage" | "echange" | "etats" | "litige";

export async function renderSecurityPage(params: Promise<{ locale: string }>, pageKey: SecurityPageKey) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("security");

  const viewer = await requireAuthViewer(`/${locale}/securite/${pageKey}`);
  const context = await getSecurityContext(viewer.id);

  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="安全" />
      <div className="mt-8">
        <SecurityPageLayout pageKey={pageKey} context={context} />
      </div>
    </main>
  );
}
