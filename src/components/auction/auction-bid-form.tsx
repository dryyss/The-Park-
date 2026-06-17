"use client";

import { useState, useTransition } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { placeBidAction } from "@/server/auction/auction.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

export function AuctionBidForm({
  auctionId,
  minAmount,
  isAuthenticated: isAuthenticatedProp,
}: {
  auctionId: string;
  minAmount: number;
  isAuthenticated?: boolean;
}) {
  const t = useTranslations("auctions");
  const router = useRouter();
  const { user } = useUser();
  const isAuthenticated = isAuthenticatedProp ?? !!user;
  const [amount, setAmount] = useState(minAmount);
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [pending, startTransition] = useTransition();

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
      const res = await placeBidAction({ auctionId, amount });
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
      <div className="mt-2 flex gap-2">
        <input
          type="number"
          step="0.01"
          min={minAmount}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="flex-1 rounded-[11px] border border-charbon-500 bg-charbon-700 px-4 py-2.5 font-display text-[18px] text-or outline-none focus:border-carmin"
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
