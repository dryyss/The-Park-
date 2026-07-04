"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  startConnectOnboardingAction,
  startConnectUpdateAction,
  withdrawEarnedAction,
  type WalletWithdrawError,
} from "@/server/wallet/wallet.actions";
import { requestWithdrawalAction } from "@/server/wallet/withdrawal.actions";
import { formatWalletEur, WALLET_MIN_WITHDRAW_EUR, type WalletConnectStatus } from "@/lib/wallet";

type WithdrawMethod = "STRIPE" | "BANK_TRANSFER" | "PAYPAL";

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
  const [method, setMethod] = useState<WithdrawMethod>("BANK_TRANSFER");
  const [iban, setIban] = useState("");
  const [holder, setHolder] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  const detailsReady =
    method === "STRIPE" ||
    (method === "BANK_TRANSFER" && iban.replace(/\s+/g, "").length >= 15 && holder.trim().length >= 2) ||
    (method === "PAYPAL" && paypalEmail.includes("@"));

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res =
        method === "STRIPE"
          ? await withdrawEarnedAction({ amountEur, locale })
          : await requestWithdrawalAction(
              method === "BANK_TRANSFER"
                ? { method, amountEur, iban, holder }
                : { method, amountEur, paypalEmail },
            );
      if (res.ok) {
        setSuccess(true);
        window.location.reload();
      } else {
        setError((res as { error: WalletWithdrawError | string }).error);
      }
    });
  }

  const inputClass =
    "rounded-lg border border-charbon-500 bg-charbon-800 px-3 py-2.5 text-[13px] font-bold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-statut-succes";

  return (
    <form onSubmit={handleWithdraw} className="mt-4 rounded-lg border border-charbon-600 bg-charbon px-3 py-3">
      <p className="text-[12px] font-bold text-texte-dim">{t("withdrawHint", { min: WALLET_MIN_WITHDRAW_EUR })}</p>

      {/* Mode de retrait */}
      <div className="mt-3 flex flex-col gap-1.5">
        <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
          {t("withdrawMethodTitle")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(["BANK_TRANSFER", "PAYPAL", "STRIPE"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-lg border px-3 py-2 text-[11px] font-extrabold transition ${
                method === m
                  ? "border-statut-succes bg-statut-succes/12 text-statut-succes"
                  : "border-charbon-500 text-texte-dim hover:border-charbon-400"
              }`}
            >
              {t(`withdrawMethods.${m}`)}
            </button>
          ))}
        </div>
      </div>

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
          className={`${inputClass} text-[14px]`}
        />
      </div>

      {method === "BANK_TRANSFER" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder={t("withdrawHolder")}
            className={inputClass}
          />
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="IBAN — FR76 …"
            className={`${inputClass} font-mono`}
          />
        </div>
      )}
      {method === "PAYPAL" && (
        <input
          type="email"
          value={paypalEmail}
          onChange={(e) => setPaypalEmail(e.target.value)}
          placeholder={t("withdrawPaypalEmail")}
          className={`${inputClass} mt-3 w-full`}
        />
      )}
      {method === "STRIPE" && !connectStatus.payoutsEnabled ? (
        <button
          type="button"
          onClick={() => handleConnect(true)}
          disabled={pending}
          className="font-display mt-3 w-full rounded-lg border border-or/50 bg-or/10 py-2.5 text-[12px] tracking-[1px] text-or uppercase transition hover:bg-or/20 disabled:opacity-50"
        >
          {pending ? t("connectPending") : t("connectCta")}
        </button>
      ) : (
        <button
          type="submit"
          disabled={pending || amountEur < WALLET_MIN_WITHDRAW_EUR || amountEur > earnedBalanceEur || !detailsReady}
          className="font-display mt-3 w-full rounded-lg bg-statut-succes/90 py-2.5 text-[12px] tracking-[1px] text-charbon uppercase transition hover:bg-statut-succes disabled:opacity-50"
        >
          {pending ? t("withdrawPending") : t("withdrawCta")}
        </button>
      )}
      {method !== "STRIPE" && (
        <p className="mt-2 text-[10.5px] font-semibold text-texte-faible">{t("withdrawManualHint")}</p>
      )}
      {method === "STRIPE" && connectStatus.payoutsEnabled && (
        <button
          type="button"
          onClick={() => handleConnect(false)}
          disabled={pending}
          className="mt-2 w-full text-[11px] font-bold text-texte-faible underline hover:text-texte-dim"
        >
          {t("connectUpdate")}
        </button>
      )}
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
