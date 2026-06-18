"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  startConnectOnboardingAction,
  startConnectUpdateAction,
  withdrawEarnedAction,
  type WalletWithdrawError,
} from "@/server/wallet/wallet.actions";
import { formatWalletEur, WALLET_MIN_WITHDRAW_EUR, type WalletConnectStatus } from "@/lib/wallet";

export function WalletWithdrawForm({
  locale,
  earnedBalanceEur,
  connectStatus,
}: {
  locale: string;
  earnedBalanceEur: number;
  connectStatus: WalletConnectStatus;
}) {
  const t = useTranslations("wallet");
  const [amountEur, setAmountEur] = useState(
    earnedBalanceEur >= WALLET_MIN_WITHDRAW_EUR ? earnedBalanceEur : WALLET_MIN_WITHDRAW_EUR,
  );
  const [error, setError] = useState<WalletWithdrawError | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConnect(onboard: boolean) {
    setError(null);
    startTransition(async () => {
      const res = onboard
        ? await startConnectOnboardingAction({ locale })
        : await startConnectUpdateAction({ locale });
      if (res.ok) window.location.href = res.redirectUrl;
      else setError(res.error);
    });
  }

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await withdrawEarnedAction({ amountEur, locale });
      if (res.ok) {
        setSuccess(true);
        window.location.reload();
      } else {
        setError(res.error);
      }
    });
  }

  if (!connectStatus.payoutsEnabled) {
    return (
      <div className="mt-4 rounded-lg border border-charbon-600 bg-charbon px-3 py-3">
        <p className="text-[12px] font-bold text-texte-dim">{t("connectRequired")}</p>
        <button
          type="button"
          onClick={() => handleConnect(true)}
          disabled={pending}
          className="font-display mt-3 w-full rounded-lg border border-or/50 bg-or/10 py-2.5 text-[12px] tracking-[1px] text-or uppercase transition hover:bg-or/20 disabled:opacity-50"
        >
          {pending ? t("connectPending") : t("connectCta")}
        </button>
        {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{t(`withdrawError.${error}`)}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleWithdraw} className="mt-4 rounded-lg border border-charbon-600 bg-charbon px-3 py-3">
      <p className="text-[12px] font-bold text-texte-dim">{t("withdrawHint", { min: WALLET_MIN_WITHDRAW_EUR })}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor="withdraw-amount" className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
          {t("withdrawAmount")}
        </label>
        <input
          id="withdraw-amount"
          type="number"
          min={WALLET_MIN_WITHDRAW_EUR}
          max={earnedBalanceEur}
          step="0.01"
          value={amountEur}
          onChange={(e) => setAmountEur(Number(e.target.value))}
          className="rounded-lg border border-charbon-500 bg-charbon-800 px-3 py-2.5 text-[14px] font-bold text-blanc-casse outline-none focus:border-statut-succes"
        />
      </div>
      <button
        type="submit"
        disabled={pending || amountEur < WALLET_MIN_WITHDRAW_EUR || amountEur > earnedBalanceEur}
        className="font-display mt-3 w-full rounded-lg bg-statut-succes/90 py-2.5 text-[12px] tracking-[1px] text-charbon uppercase transition hover:bg-statut-succes disabled:opacity-50"
      >
        {pending ? t("withdrawPending") : t("withdrawCta")}
      </button>
      <button
        type="button"
        onClick={() => handleConnect(false)}
        disabled={pending}
        className="mt-2 w-full text-[11px] font-bold text-texte-faible underline hover:text-texte-dim"
      >
        {t("connectUpdate")}
      </button>
      {success && <p className="mt-2 text-[11px] font-bold text-statut-succes">{t("withdrawSuccess")}</p>}
      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{t(`withdrawError.${error}`)}</p>}
    </form>
  );
}

export function WalletEarnedBalances({
  earnedBalanceEur,
  spendableBalanceEur,
}: {
  earnedBalanceEur: number;
  spendableBalanceEur: number;
}) {
  const t = useTranslations("wallet");

  return (
    <>
      <p className="mt-3 text-[13px] font-bold text-texte-doux">
        {t("earnedBalance")}{" "}
        <span className="font-display text-[22px] text-statut-succes">{formatWalletEur(earnedBalanceEur)} €</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold text-texte-faible">{t("earnedHint")}</p>
      <p className="mt-4 rounded-lg border border-charbon-600 bg-charbon px-3 py-2.5 text-[12px] font-bold text-texte-dim">
        {t("spendableBalance")}{" "}
        <span className="text-blanc-casse">{formatWalletEur(spendableBalanceEur)} €</span>
      </p>
    </>
  );
}
