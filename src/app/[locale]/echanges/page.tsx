import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getViewerExchanges, getViewerOwnedCardsForPropose, type ExchangeTab } from "@/server/exchange/exchange.service";
import { PageHeader } from "@/components/common/page-header";
import { ExchangeBoard } from "@/components/exchange/exchange-board";

export const dynamic = "force-dynamic";

type SP = { tab?: string; id?: string };

export default async function EchangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("exchanges");

  const viewer = await requireAuthViewer(`/${locale}/echanges`);

  const tab: ExchangeTab = sp.tab === "done" ? "done" : "current";
  const data = await getViewerExchanges(viewer.id, tab, sp.id);
  const ownedCards = data.selected?.status === "PROPOSED" && !data.selected.viewerIsInitiator
    ? await getViewerOwnedCardsForPropose(viewer.id)
    : [];

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="交換" />
      <div className="mt-6">
        <ExchangeBoard tab={tab} current={data.current} done={data.done} selected={data.selected} ownedCards={ownedCards} />
      </div>
    </main>
  );
}
