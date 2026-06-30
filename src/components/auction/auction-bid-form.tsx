"use client";

import { useState, useTransition } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { placeBidAction } from "@/server/auction/auction.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

// Pas minimum imposé sur toute enchère : 10 centimes.
const MIN_STEP = 0.1;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function AuctionBidForm({
  auctionId,
  minAmount,
  increment = MIN_STEP,
  isAuthenticated: isAuthenticatedProp,
}: {
  auctionId: string;
  minAmount: number;
  increment?: number;
  isAuthenticated?: boolean;
}) {
  const t = useTranslations("auctions");
  const format = useFormatter();
  const router = useRouter();
  const { user } = useUser();
  const isAuthenticated = isAuthenticatedProp ?? !!user;
  // Jamais en dessous de 10 centimes, même si le pas de la vente est plus fin.
  const step = Math.max(MIN_STEP, increment);
  const [amount, setAmount] = useState(round2(minAmount));
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [pending, startTransition] = useTransition();

  // Boutons de suggestion : minimum, puis quelques paliers au-dessus.
  const suggestions = [0, 1, 5, 10]
    .map((k) => round2(minAmount + k * step))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const eur = (v: number) => format.number(v, { style: "currency", currency: "EUR" });

  // Recale la saisie sur la grille du pas, sans jamais passer sous le minimum.
  function normalize(v: number): number {
    if (!Number.isFinite(v) || v < minAmount) return round2(minAmount);
    const steps = Math.round((v - minAmount) / step);
    return round2(minAmount + steps * step);
  }

  function errorMessage(code: string): string {
    switch (code) {
      case "BID_TOO_LOW":
        return t("errorBidTooLow", { amount: minAmount });
      case "SELF_BID":
        return t("errorSelfBid");
      case "AUCTION_NOT_FOUND":
        return t("errorEnded");
      default:
        return t("errorGeneric");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    startTransition(async () => {
      setError(null);
      setShowLoginGate(false);
      const res = await placeBidAction({ auctionId, amount: normalize(amount) });
      if (!res.ok) {
        if (res.error === "UNAUTHORIZED") setShowLoginGate(true);
        else setError(errorMessage(res.error));
      } else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-6">
      {showLoginGate && <div className="mb-3"><LoginGatePrompt compact messageKey="loginGateAuction" /></div>}
      <label className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("yourBid")}</label>

      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((value, i) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(value)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold transition ${
              amount === value
                ? "border-carmin bg-carmin/15 text-carmin"
                : "border-charbon-500 bg-charbon-700 text-texte-dim hover:border-carmin/60 hover:text-blanc-casse"
            }`}
          >
            {i === 0 ? t("bidMin", { amount: eur(value) }) : eur(value)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="number"
          step={step}
          min={minAmount}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          onBlur={() => setAmount((v) => normalize(v))}
          className="w-[140px] min-w-0 rounded-[11px] border border-charbon-500 bg-charbon-700 px-4 py-2.5 font-display text-[18px] text-or outline-none focus:border-carmin"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[12px] bg-carmin px-6 py-3.5 font-display text-[14px] tracking-[1.5px] text-white uppercase disabled:opacity-50"
        >
          {t("bid")}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] font-bold text-neon-rouge">{error}</p>}
      <p className="mt-3 text-center text-[11px] font-bold text-texte-faible">{t("disclaimer")}</p>
    </form>
  );
}
