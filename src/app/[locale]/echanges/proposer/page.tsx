import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerOwnedCardsForPropose } from "@/server/exchange/exchange.service";
import { PageHeader } from "@/components/common/page-header";
import { ExchangeProposeForm } from "@/components/exchange/exchange-propose-form";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EchangesProposerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ recipient?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("exchangePropose");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;
  const defaultRecipient = sp.recipient?.trim() ?? "";

  const [ownedCards, recipientUser] = await Promise.all([
    viewer ? getViewerOwnedCardsForPropose(viewer.id) : Promise.resolve([]),
    defaultRecipient
      ? prisma.user.findFirst({ where: { slug: defaultRecipient }, select: { displayName: true } })
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="提案" />
      <p className="mt-3 text-[13px] font-bold text-texte-dim">{t("subtitle")}</p>
      {!isAuthenticated && <GuestAuthBanner messageKey="loginGateExchanges" />}
      <div className="mt-8">
        <ExchangeProposeForm
          ownedCards={ownedCards}
          defaultRecipient={defaultRecipient}
          defaultRecipientName={recipientUser?.displayName ?? ""}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </main>
  );
}
