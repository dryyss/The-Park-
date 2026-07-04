import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getExchangeStateMachine } from "@/server/c2c/state-machine.service";
import { PageHeader } from "@/components/common/page-header";
import { ExchangeStateMachine } from "@/components/security/exchange-state-machine";
import { renderSecurityPage } from "@/lib/security-page";

export const dynamic = "force-dynamic";

export default async function EtatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await requireAuthViewer(`/${locale}/securite/etats`);
  const view = await getExchangeStateMachine(viewer.id);

  // Aucun échange : on retombe sur la page pédagogique statique (schéma des états).
  if (!view) return renderSecurityPage(params, "etats");

  const t = await getTranslations("security");
  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="安全" />
      <div className="mt-8">
        <ExchangeStateMachine view={view} />
      </div>
    </main>
  );
}
