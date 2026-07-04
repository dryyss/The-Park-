"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setWishlistAlertPriceAction } from "@/server/wishlist/wishlist.actions";

/**
 * Réglage du seuil d'alerte prix d'une carte de la wishlist. Sans seuil, le membre
 * reçoit une alerte de disponibilité ; avec seuil, une alerte prix ciblée quand une
 * annonce descend à ce prix ou moins.
 */
export function WishlistAlertControl({
  wishlistItemId,
  alertPrice,
  onRequireAuth,
}: {
  wishlistItemId: string;
  alertPrice: number | null;
  onRequireAuth?: () => boolean;
}) {
  const t = useTranslations("wishlist");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alertPrice != null ? String(alertPrice) : "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function save(next: number | null) {
    if (onRequireAuth && onRequireAuth()) return;
    setError(false);
    startTransition(async () => {
      const res = await setWishlistAlertPriceAction({ wishlistItemId, alertPrice: next });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(true);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(true);
      return;
    }
    save(Math.round(parsed * 100) / 100);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={[
          "mt-1.5 w-full rounded-lg border py-1.5 text-[11px] font-extrabold transition",
          alertPrice != null
            ? "border-or/50 bg-or/10 text-or hover:border-or"
            : "border-charbon-500 text-texte-dim hover:border-carmin hover:text-carmin",
        ].join(" ")}
      >
        {alertPrice != null ? t("alertActive", { price: `${alertPrice} €` }) : t("alertSet")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1.5">
      <div className="flex gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("alertPlaceholder")}
          className="min-w-0 flex-1 rounded-lg border border-charbon-500 bg-charbon px-2 py-1.5 text-[11px] font-bold text-blanc-casse outline-none focus:border-carmin"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-carmin px-2.5 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-50"
        >
          {t("alertSave")}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between">
        {alertPrice != null ? (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={pending}
            className="text-[10.5px] font-bold text-texte-faible hover:text-neon-rouge disabled:opacity-50"
          >
            {t("alertClear")}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[10.5px] font-bold text-texte-faible hover:text-texte-doux"
        >
          {t("cancel")}
        </button>
      </div>
      {error && <p className="mt-1 text-[10.5px] font-bold text-neon-rouge">{t("alertError")}</p>}
    </form>
  );
}
