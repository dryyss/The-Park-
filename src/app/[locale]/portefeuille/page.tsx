import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { getWalletSummary } from "@/server/wallet/wallet.service";
import { confirmWalletTopUpAction } from "@/server/wallet/wallet.actions";
import { PageHeader } from "@/components/common/page-header";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { WalletTopUpForm } from "@/components/wallet/wallet-top-up-form";
import { formatWalletEur } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function PortefeuillePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ success?: string; session_id?: string; cancelled?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("wallet");

  const viewer = await getAuthenticatedViewer();
  if (sp.success === "1" && sp.session_id && viewer) {
    await confirmWalletTopUpAction(sp.session_id);
  }

  const summary = viewer ? await getWalletSummary(viewer.id) : null;

  return (
    <main className="mx-auto max-w-[720px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="残高" />
      {!viewer && <GuestAuthBanner messageKey="loginGateWallet" />}

      {sp.cancelled === "1" && (
        <p className="mt-4 rounded-lg border border-charbon-500 bg-charbon-800 px-4 py-3 text-[13px] font-bold text-texte-dim">
          {t("topUpCancelled")}
        </p>
      )}
      {sp.success === "1" && viewer && (
        <p className="mt-4 rounded-lg border border-statut-succes/40 bg-statut-succes/10 px-4 py-3 text-[13px] font-bold text-statut-succes">
          {t("topUpSuccess")}
        </p>
      )}

      {viewer && summary && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <WalletTopUpForm locale={locale} balanceEur={summary.balanceEur} />

          <div className="rounded-2xl border border-charbon-500 bg-charbon-800 p-5">
            <p className="text-[11px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("historyTitle")}</p>
            {summary.recentEntries.length === 0 ? (
              <p className="mt-4 text-[13px] font-bold text-texte-dim">{t("historyEmpty")}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {summary.recentEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-lg border border-charbon-600 px-3 py-2 text-[12px]">
                    <span className="font-bold text-texte-doux">{t(`entryType.${e.type}`)}</span>
                    <span className={e.amountEur >= 0 ? "font-extrabold text-statut-succes" : "font-extrabold text-carmin"}>
                      {e.amountEur >= 0 ? "+" : ""}
                      {formatWalletEur(e.amountEur)} €
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
