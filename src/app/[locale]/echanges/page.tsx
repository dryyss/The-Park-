import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerExchanges, getViewerOwnedCardsForPropose, getTradeOpportunities, type ExchangeTab } from "@/server/exchange/exchange.service";
import { PageHeader } from "@/components/common/page-header";
import { ExchangeBoard } from "@/components/exchange/exchange-board";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";

export const dynamic = "force-dynamic";

type SP = { tab?: string; id?: string };

const EMPTY_COUNTS = { incoming: 0, outgoing: 0, active: 0 };

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

  const viewer = await getViewerUser();
  const tab: ExchangeTab = sp.tab === "done" ? "done" : "current";

  if (!viewer) {
    const opportunities = await getTradeOpportunities(null);
    return (
      <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
        <PageHeader kicker={t("kicker")} title={t("title")} jp="交換" />
        <GuestAuthBanner messageKey="loginGateExchanges" />
        <div className="mt-6">
          <ExchangeBoard
            tab={tab}
            current={[]}
            done={[]}
            selected={null}
            counts={EMPTY_COUNTS}
            opportunities={opportunities}
            isAuthenticated={false}
          />
        </div>
      </main>
    );
  }

  const data = await getViewerExchanges(viewer.id, tab, sp.id);
  const ownedCards = data.selected?.status === "PROPOSED" && !data.selected.viewerIsInitiator
    ? await getViewerOwnedCardsForPropose(viewer.id)
    : [];

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="交換" />
      <div className="mt-6">
        <ExchangeBoard
          tab={tab}
          current={data.current}
          done={data.done}
          selected={data.selected}
          counts={data.counts}
          opportunities={data.opportunities}
          ownedCards={ownedCards}
          isAuthenticated
        />
      </div>
    </main>
  );
}
