"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { startWalletTopUpAction } from "@/server/wallet/wallet.actions";
import { WALLET_MIN_TOP_UP_EUR, quoteWalletTopUp, formatWalletEur } from "@/lib/wallet";

export function WalletTopUpForm({
  locale,
  depositBalanceEur,
}: {
  locale: string;
  depositBalanceEur: number;
}) {
  const t = useTranslations("wallet");
  const [creditEur, setCreditEur] = useState(WALLET_MIN_TOP_UP_EUR);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quote = quoteWalletTopUp(creditEur);
  const canSubmit = acceptTerms && creditEur >= WALLET_MIN_TOP_UP_EUR;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError(t("topUpError.TERMS_NOT_ACCEPTED"));
      return;
    }
    startTransition(async () => {
      const res = await startWalletTopUpAction({ creditEur, acceptTerms: true, locale });
      if (res.ok) window.location.href = res.redirectUrl;
      else setError(t(`topUpError.${res.error}`));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-charbon-500 bg-charbon-800 p-5">
      <p className="text-[11px] font-extrabold tracking-[2px] text-or uppercase">{t("topUpTitle")}</p>
      <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("topUpHint", { min: WALLET_MIN_TOP_UP_EUR })}</p>
      <p className="mt-3 text-[13px] font-bold text-texte-doux">
        {t("depositBalance")}{" "}
        <span className="font-display text-[22px] text-carmin">{formatWalletEur(depositBalanceEur)} €</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold text-texte-faible">{t("depositHint")}</p>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="wallet-credit" className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
          {t("creditAmount")}
        </label>
        <input
          id="wallet-credit"
          type="number"
          min={WALLET_MIN_TOP_UP_EUR}
          step="0.01"
          value={creditEur}
          onChange={(e) => setCreditEur(Number(e.target.value))}
          className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[14px] font-bold text-blanc-casse outline-none focus:border-carmin"
        />
      </div>

      <div className="mt-4 space-y-1 rounded-lg border border-charbon-600 bg-charbon px-3 py-2.5 text-[12px] font-bold text-texte-doux">
        <div className="flex justify-between">
          <span>{t("creditLine")}</span>
          <span>{formatWalletEur(quote.creditEur)} €</span>
        </div>
        <div className="flex justify-between text-texte-dim">
          <span>{t("feeLine")}</span>
          <span>+ {formatWalletEur(quote.feeEur)} €</span>
        </div>
        <div className="flex justify-between border-t border-charbon-600 pt-2 text-blanc-casse">
          <span>{t("totalLine")}</span>
          <span className="text-or">{formatWalletEur(quote.totalChargeEur)} €</span>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-carmin"
        />
        <span className="text-[12px] font-semibold leading-relaxed text-texte-dim">
          {t.rich("acceptTermsLabel", {
            link: (chunks) => (
              <Link href="/aide" className="text-carmin underline underline-offset-2 hover:text-carmin-alt">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="font-display mt-4 w-full rounded-lg bg-carmin py-3 text-[13px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
      >
        {pending ? t("topUpPending") : t("topUpCta")}
      </button>
      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
    </form>
  );
}
