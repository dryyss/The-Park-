"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { acceptExchangeAction, cancelExchangeAction } from "@/server/exchange/exchange.actions";
import type { ExchangeDetail } from "@/server/exchange/exchange.service";

export function ExchangeActionsPanel({
  detail,
  ownedCards,
}: {
  detail: ExchangeDetail;
  ownedCards: { variantId: string; name: string; availableQuantity?: number }[];
}) {
  const t = useTranslations("exchanges");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const canRespond = detail.status === "PROPOSED" && !detail.viewerIsInitiator;
  const canCancel = detail.status === "PROPOSED";

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function accept() {
    startTransition(async () => {
      setError(null);
      const res = await acceptExchangeAction(detail.id, selected);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      setError(null);
      const res = await cancelExchangeAction(detail.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  if (!canRespond && !canCancel) return null;

  return (
    <div className="border-t border-charbon-600 px-6 py-4">
      {canRespond && (
        <div className="mb-4">
          <p className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("selectGiveCards")}</p>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {ownedCards.map((c) => (
              <button
                key={c.variantId}
                type="button"
                onClick={() => toggle(c.variantId)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${selected.includes(c.variantId) ? "border-carmin bg-carmin/20 text-white" : "border-charbon-500 text-texte-dim"}`}
              >
                {c.name}
                {c.availableQuantity != null && c.availableQuantity > 1 && (
                  <span className="ml-1 tabular-nums text-carmin">×{c.availableQuantity}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="mb-2 text-[12px] font-bold text-neon-rouge">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {canRespond && (
          <button
            type="button"
            disabled={pending || selected.length === 0}
            onClick={accept}
            className="rounded-[11px] bg-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-white uppercase disabled:opacity-50"
          >
            {t("accept")}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={cancel}
            className="rounded-[11px] border border-charbon-400 px-5 py-2.5 font-display text-[12px] tracking-wide text-texte-doux uppercase disabled:opacity-50"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
