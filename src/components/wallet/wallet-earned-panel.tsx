import { getTranslations } from "next-intl/server";
import { getWalletConnectStatus } from "@/server/wallet/wallet-connect.service";
import { WalletWithdrawForm, WalletEarnedBalances } from "@/components/wallet/wallet-withdraw-form";

export async function WalletEarnedPanel({
  userId,
  locale,
  earnedBalanceEur,
  spendableBalanceEur,
}: {
  userId: string;
  locale: string;
  earnedBalanceEur: number;
  spendableBalanceEur: number;
}) {
  const t = await getTranslations("wallet");
  const connectStatus = await getWalletConnectStatus(userId);

  return (
    <div className="rounded-2xl border border-charbon-500 bg-charbon-800 p-5">
      <p className="text-[11px] font-extrabold tracking-[2px] text-statut-succes uppercase">{t("earnedTitle")}</p>
      <WalletEarnedBalances earnedBalanceEur={earnedBalanceEur} spendableBalanceEur={spendableBalanceEur} />
      <WalletWithdrawForm locale={locale} earnedBalanceEur={earnedBalanceEur} connectStatus={connectStatus} />
    </div>
  );
}
