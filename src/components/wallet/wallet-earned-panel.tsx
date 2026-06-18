import { formatWalletEur } from "@/lib/wallet";
import { getTranslations } from "next-intl/server";

export async function WalletEarnedPanel({
  earnedBalanceEur,
  spendableBalanceEur,
}: {
  earnedBalanceEur: number;
  spendableBalanceEur: number;
}) {
  const t = await getTranslations("wallet");

  return (
    <div className="rounded-2xl border border-charbon-500 bg-charbon-800 p-5">
      <p className="text-[11px] font-extrabold tracking-[2px] text-statut-succes uppercase">{t("earnedTitle")}</p>
      <p className="mt-3 text-[13px] font-bold text-texte-doux">
        {t("earnedBalance")}{" "}
        <span className="font-display text-[22px] text-statut-succes">{formatWalletEur(earnedBalanceEur)} €</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold text-texte-faible">{t("earnedHint")}</p>
      <p className="mt-4 rounded-lg border border-charbon-600 bg-charbon px-3 py-2.5 text-[12px] font-bold text-texte-dim">
        {t("spendableBalance")}{" "}
        <span className="text-blanc-casse">{formatWalletEur(spendableBalanceEur)} €</span>
      </p>
    </div>
  );
}
