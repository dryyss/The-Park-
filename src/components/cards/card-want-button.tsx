"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CONDITION_ORDER, type ConditionCode } from "@/lib/condition";
import { publishWantListingAction } from "@/server/marketplace/marketplace.actions";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";

type WantVersion = { variantId: string; label: string };

export function CardWantButton({
  versions,
  isAuthenticated,
}: {
  versions: WantVersion[];
  isAuthenticated: boolean;
}) {
  const t = useTranslations("want");
  const tc = useTranslations("card");
  const tcond = useTranslations("conditions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState(versions[0]?.variantId ?? "");
  const [budget, setBudget] = useState("");
  const [minCondition, setMinCondition] = useState<ConditionCode | "">("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);

  if (versions.length === 0) return null;

  function publish() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    if (!variantId) return;
    const parsedBudget = budget.trim() ? parseFloat(budget.replace(",", ".")) : undefined;
    if (parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
      setError("VALIDATION");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await publishWantListingAction({
        variantId,
        budgetMax: parsedBudget,
        minCondition: minCondition || undefined,
      });
      if (res.ok) {
        setSuccess(true);
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-3">
      {success ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-statut-succes/40 bg-statut-succes/8 px-4 py-3">
          <span className="text-[13px] font-bold text-statut-succes">{t("publishSuccess")}</span>
          <button
            type="button"
            onClick={() => router.push("/marketplace?intent=want")}
            className="font-display text-[12px] tracking-wide text-carmin uppercase hover:underline"
          >
            {t("backToWants")} →
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-display -skew-x-3 rounded-[10px] border-[1.5px] border-charbon-400 px-5.5 py-3.5 text-[14px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin"
          >
            {tc("wantCta")}
          </button>

          {open && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-[14px] border border-charbon-500 bg-charbon-800 p-4">
              {versions.length > 1 && (
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{tc("wantVersion")}</span>
                  <select
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] font-bold text-blanc-casse outline-none focus:border-carmin"
                  >
                    {versions.map((v) => (
                      <option key={v.variantId} value={v.variantId} className="bg-charbon-800">{v.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
                  {t("budgetLabel")} · {t("budgetOptional")}
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0"
                    className="w-32 rounded-lg border border-charbon-500 bg-charbon px-3 py-2 pr-8 text-[14px] font-bold text-blanc-casse outline-none focus:border-carmin"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-texte-faible">€</span>
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("minConditionLabel")}</span>
                <select
                  value={minCondition}
                  onChange={(e) => setMinCondition(e.target.value as ConditionCode | "")}
                  className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] font-bold text-blanc-casse outline-none focus:border-carmin"
                >
                  <option value="" className="bg-charbon-800">{t("minConditionAny")}</option>
                  {CONDITION_ORDER.map((code) => (
                    <option key={code} value={code} className="bg-charbon-800">{tcond(code)}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={publish}
                className="font-display -skew-x-3 rounded-lg bg-carmin px-5 py-2.5 text-[12.5px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
              >
                {pending ? t("publishing") : t("publish")}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-[12px] font-bold text-neon-rouge">{t("publishError")}</p>}
          {showLoginGate && <div className="mt-3"><LoginGatePrompt compact messageKey="loginGateExchanges" /></div>}
        </>
      )}
    </div>
  );
}
