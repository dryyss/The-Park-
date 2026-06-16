"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { placeBidAction } from "@/server/auction/auction.actions";

export function AuctionBidForm({ auctionId, minAmount }: { auctionId: string; minAmount: number }) {
  const t = useTranslations("auctions");
  const router = useRouter();
  const [amount, setAmount] = useState(minAmount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const res = await placeBidAction({ auctionId, amount });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-6">
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
