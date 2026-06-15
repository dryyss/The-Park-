import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getViewerOwnedCardsForPropose } from "@/server/exchange/exchange.service";
import { PageHeader } from "@/components/common/page-header";
import { ExchangeProposeForm } from "@/components/exchange/exchange-propose-form";

export const dynamic = "force-dynamic";

export default async function EchangesProposerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exchangePropose");

  const viewer = await requireAuthViewer(`/${locale}/echanges/proposer`);
  const ownedCards = await getViewerOwnedCardsForPropose(viewer.id);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="提案" />
      <p className="mt-3 text-[13px] font-bold text-texte-dim">{t("subtitle")}</p>
      <div className="mt-8">
        <ExchangeProposeForm ownedCards={ownedCards} />
      </div>
    </main>
  );
}
