"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { CONDITION_ORDER, conditionColor, type ConditionCode } from "@/lib/condition";
import { publishWantListingAction } from "@/server/marketplace/marketplace.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

export type WantCatalogCard = {
  variantId: string;
  slug: string;
  name: string;
  number: number;
  image: string | null;
  glyph: string;
  color: string;
};

export function WantForm({
  cards,
  isAuthenticated = true,
}: {
  cards: WantCatalogCard[];
  isAuthenticated?: boolean;
}) {
  const t = useTranslations("want");
  const tc = useTranslations("conditions");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [minCondition, setMinCondition] = useState<ConditionCode | "">("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.number).padStart(2, "0").includes(q),
    );
  }, [cards, query]);

  const selected = cards.find((c) => c.variantId === selectedId) ?? null;

  function handlePublish() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    if (!selected) {
      setError("VALIDATION");
      return;
    }
    const parsedBudget = budget.trim() ? parseFloat(budget.replace(",", ".")) : undefined;
    if (parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
      setError("VALIDATION");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await publishWantListingAction({
        variantId: selected.variantId,
        budgetMax: parsedBudget,
        minCondition: minCondition || undefined,
      });
      if (res.ok) {
        setSuccess(true);
        router.push("/marketplace?intent=want");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="01" title={t("stepPickCard")} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="mb-3 w-full rounded-[11px] border border-charbon-500 bg-charbon px-4 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] font-bold text-texte-faible">{t("noResults")}</p>
          ) : (
            <div className="grid max-h-[420px] grid-cols-3 gap-3 overflow-y-auto pb-1 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((c) => (
                <button
                  key={c.variantId}
                  type="button"
                  onClick={() => setSelectedId(c.variantId)}
                  className="cursor-pointer text-left"
                >
                  <div
                    className={`relative aspect-[5/7] overflow-hidden rounded-[10px] border-[2.5px] shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 ${
                      selectedId === c.variantId ? "border-carmin" : "border-charbon-500"
                    }`}
                  >
                    {c.image && <Image src={c.image} alt={c.name} fill className="object-cover" sizes="92px" />}
                    <span
                      className="font-display absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] tracking-wide"
                      style={{ background: "rgba(0,0,0,0.7)", color: c.color }}
                    >
                      {c.glyph}
                    </span>
                  </div>
                  <div className="mt-1.5 truncate text-center text-[9.5px] font-extrabold text-texte-doux">{c.name}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="02" title={t("stepCriteria")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">
                {t("budgetLabel")} · <span className="text-texte-dim">{t("budgetOptional")}</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0"
                  className="font-display w-full rounded-[11px] border-[1.5px] border-charbon-500 bg-charbon px-4 py-3 pr-10 text-[18px] text-blanc-casse outline-none focus:border-carmin"
                />
                <span className="font-display pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[16px] text-texte-faible">€</span>
              </div>
            </div>
            <div>
              <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("minConditionLabel")}</label>
              <select
                value={minCondition}
                onChange={(e) => setMinCondition(e.target.value as ConditionCode | "")}
                className="mt-1.5 w-full rounded-[11px] border-[1.5px] border-charbon-500 bg-charbon px-4 py-3 text-[14px] font-bold text-blanc-casse outline-none focus:border-carmin"
              >
                <option value="" className="bg-charbon-800">{t("minConditionAny")}</option>
                {CONDITION_ORDER.map((code) => (
                  <option key={code} value={code} className="bg-charbon-800">
                    {tc(code)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="03" title={t("stepPublish")} />
          <p className="mb-4 text-[12.5px] font-semibold text-texte-dim">{t("disclaimer")}</p>
          {success && <p className="mb-3 text-[13px] font-bold text-statut-succes">{t("publishSuccess")}</p>}
          {error && <p className="mb-3 text-[13px] font-bold text-neon-rouge">{t("publishError")}</p>}
          {showLoginGate && <div className="mb-3"><LoginGatePrompt compact messageKey="loginGateExchanges" /></div>}
          <button
            type="button"
            disabled={pending || success || !selected}
            onClick={handlePublish}
            className="font-display w-full -skew-x-3 rounded-[11px] bg-carmin px-6 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("publishing") : t("publish")}
          </button>
        </section>
      </div>

      <aside className="sticky top-24 rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
        <div className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("preview")}</div>
        {selected ? (
          <>
            <div className="relative mx-auto mt-3 aspect-[5/7] w-[180px] overflow-hidden rounded-xl shadow-[0_16px_32px_rgba(0,0,0,0.5)]">
              {selected.image && <Image src={selected.image} alt={selected.name} fill className="object-cover" sizes="180px" />}
            </div>
            <div className="mt-3 text-center text-[14px] font-extrabold text-blanc-casse">{selected.name}</div>
            <div className="mt-1 text-center text-[11px] font-bold text-texte-dim">#{String(selected.number).padStart(2, "0")}</div>
            <div className="mt-4 rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-center text-[12px] font-bold text-texte-doux">
              {budget.trim() ? `${t("budgetLabel")} : ${budget} €` : t("budgetNone")}
              {minCondition && (
                <span className="mt-1 block text-[11px]" style={{ color: conditionColor(minCondition) }}>
                  {t("minConditionLabel")} : {tc(minCondition)}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="mt-6 text-center text-[12.5px] font-bold text-texte-faible">{t("selectedNone")}</p>
        )}
        <Link href="/marketplace?intent=want" className="font-display mt-5 block text-center text-[12px] tracking-wide text-carmin uppercase hover:underline">
          {t("backToWants")} →
        </Link>
      </aside>
    </div>
  );
}

function StepHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-2.5">
      <span className="font-display text-[15px] text-carmin -skew-x-3">{n}</span>
      <div className="font-display text-[17px] tracking-wide -skew-x-3 uppercase">{title}</div>
    </div>
  );
}
