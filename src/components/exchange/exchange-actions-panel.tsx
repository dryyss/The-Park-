"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { acceptExchangeAction, cancelExchangeAction, confirmExchangeAction } from "@/server/exchange/exchange.actions";
import type { ExchangeDetail } from "@/server/exchange/exchange.service";

export function ExchangeActionsPanel({
  detail,
  ownedCards,
}: {
  detail: ExchangeDetail;
  ownedCards: { variantId: string; name: string; image?: string | null; availableQuantity?: number }[];
}) {
  const t = useTranslations("exchanges");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const canRespond = detail.status === "PROPOSED" && !detail.viewerIsInitiator;
  const canCancel = detail.status === "PROPOSED";
  const canConfirm = detail.status === "ACCEPTED";

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

  function confirm() {
    startTransition(async () => {
      setError(null);
      const res = await confirmExchangeAction(detail.id);
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

  if (!canRespond && !canCancel && !canConfirm) return null;

  return (
    <div className="border-t border-charbon-600 px-6 py-4">
      {canRespond && (
        <div className="mb-4">
          <p className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("selectGiveCards")}</p>
          <div className="mt-2 grid max-h-52 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {ownedCards.map((c) => {
              const isSelected = selected.includes(c.variantId);
              return (
                <button
                  key={c.variantId}
                  type="button"
                  onClick={() => toggle(c.variantId)}
                  className={`flex flex-col items-center rounded-lg border p-1.5 text-center transition ${
                    isSelected ? "border-carmin bg-carmin/20" : "border-charbon-500 hover:border-charbon-400"
                  }`}
                >
                  <div className="relative aspect-[5/7] w-full overflow-hidden rounded-[6px] bg-charbon-600">
                    {c.image ? (
                      <Image src={c.image} alt={c.name} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-texte-faible">⇄</div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-carmin/40">
                        <span className="text-[18px] font-extrabold text-white">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[9.5px] font-extrabold leading-tight text-blanc-casse">{c.name}</p>
                  {c.availableQuantity != null && c.availableQuantity > 1 && (
                    <span className="text-[9px] font-bold tabular-nums text-carmin">×{c.availableQuantity}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canConfirm && (
        <div className="mb-4 rounded-lg border border-[rgba(232,178,58,0.3)] bg-[rgba(232,178,58,0.08)] px-4 py-3">
          <p className="text-[12px] font-extrabold text-or">{t("confirmTitle")}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-texte-dim">{t("confirmHint")}</p>
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
        {canConfirm && (
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="rounded-[11px] bg-or px-5 py-2.5 font-display text-[12px] tracking-wide text-charbon uppercase disabled:opacity-50"
          >
            {t("confirmShipment")}
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
