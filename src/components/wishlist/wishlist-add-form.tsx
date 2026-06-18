"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addToWishlistAction } from "@/server/wishlist/wishlist.actions";
import { CONDITION_ORDER, conditionColor } from "@/lib/condition";
import type { ConditionCode } from "@/lib/condition";
import type { EditionPresetCode } from "@/lib/card-edition";

export type WishlistVersionOption = {
  variantId: string;
  label: string;
  catalogEditionLabel: string | null;
};

export function WishlistAddForm({
  cardId,
  seasonId,
  seasonLabel,
  versions,
  onClose,
}: {
  cardId: string;
  seasonId: string;
  seasonLabel: string;
  versions: WishlistVersionOption[];
  onClose?: () => void;
}) {
  const t = useTranslations("wishlist");
  const tCard = useTranslations("card");
  const tCond = useTranslations("conditions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variantId, setVariantId] = useState(versions[0]?.variantId ?? "");
  const [condition, setCondition] = useState<ConditionCode>("EXCELLENT");
  const [editionPreset, setEditionPreset] = useState<EditionPresetCode>("unlimited");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId) return;
    setError(null);
    startTransition(async () => {
      const res = await addToWishlistAction({
        cardId,
        variantId,
        seasonId,
        condition,
        editionPreset,
      });
      if (res.ok) {
        setSuccess(true);
        router.refresh();
        onClose?.();
      } else {
        setError(res.error === "ALREADY_EXISTS" ? t("errorDuplicate") : t("errorGeneric"));
      }
    });
  }

  if (versions.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-or/30 bg-or/5 p-4">
      <p className="text-[11px] font-extrabold tracking-[2px] text-or uppercase">{t("formTitle")}</p>
      <p className="mt-1 text-[11px] font-bold text-texte-dim">{t("formHint")}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wishlist-season" className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
            {t("fieldSeason")}
          </label>
          <div
            id="wishlist-season"
            className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[12px] font-bold text-blanc-casse"
          >
            {seasonLabel}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wishlist-version" className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
            {t("fieldVersion")}
          </label>
          <select
            id="wishlist-version"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[12px] font-bold text-blanc-casse outline-none focus:border-carmin"
          >
            {versions.map((v) => (
              <option key={v.variantId} value={v.variantId}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{tCard("editionLabel")}</span>
          <div className="flex flex-wrap gap-1.5">
            {(["first", "unlimited"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setEditionPreset(key)}
                className={[
                  "rounded-md border px-2.5 py-1.5 text-[11px] font-extrabold transition",
                  editionPreset === key
                    ? "border-carmin bg-carmin/15 text-blanc-casse"
                    : "border-charbon-500 text-texte-dim hover:border-charbon-400",
                ].join(" ")}
              >
                {key === "first" ? tCard("editionFirst") : tCard("editionReedition")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="wishlist-condition" className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
            {t("fieldCondition")}
          </label>
          <select
            id="wishlist-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as ConditionCode)}
            className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[12px] font-bold outline-none focus:border-carmin"
            style={{ color: conditionColor(condition) }}
          >
            {CONDITION_ORDER.map((code) => (
              <option key={code} value={code} style={{ color: conditionColor(code) }}>
                {tCond(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || !variantId}
          className="font-display rounded-lg bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {pending ? t("adding") : t("confirmAdd")}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-charbon-500 px-4 py-2.5 text-[12px] font-bold text-texte-dim hover:border-charbon-400"
          >
            {t("cancel")}
          </button>
        )}
      </div>

      {success && <p className="mt-2 text-[11px] font-bold text-statut-succes">{t("addedSuccess")}</p>}
      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
    </form>
  );
}
