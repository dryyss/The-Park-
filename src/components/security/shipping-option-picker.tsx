"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const PERKS = ["perk1", "perk2", "perk3", "perk4"] as const;
const FLOW = [
  { n: "1", color: "#635bff", key: "flow1" },
  { n: "2", color: "#4fa3ff", key: "flow2" },
  { n: "3", color: "#4fa3ff", key: "flow3" },
  { n: "4", color: "#5ed99a", key: "flow4" },
] as const;

export function ShippingOptionPicker() {
  const t = useTranslations("security.shippingOption");
  const [secured, setSecured] = useState(true);

  const cardPrice = 14.5;
  const shipping = 2.9;
  const secureFee = secured ? 2.9 : 0;
  const total = cardPrice + shipping + secureFee;
  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  return (
    <div>
      <header className="flex h-16 items-center justify-between border-b border-charbon-500 bg-charbon-800 px-7">
        <Link href="/marketplace" className="flex items-center gap-3 no-underline">
          <span className="h-[38px] w-[38px] -rotate-[4deg] overflow-hidden rounded-[9px] bg-blanc-casse">
            <img src="/uploads/pasted-1781200672492-0.png" alt="The Park" className="h-full w-full scale-110 object-cover" />
          </span>
          <div>
            <div className="font-display text-[17px] tracking-[1.5px] text-blanc-casse">THE PARK</div>
            <div className="text-[9px] font-extrabold tracking-[1.5px] text-carmin uppercase">{t("headerTag")}</div>
          </div>
        </Link>
        <div className="flex items-center gap-2 text-[12px] font-bold text-texte-muet">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5ed99a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t("stripeHint")}
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-7 py-8 pb-16">
        <nav className="flex flex-wrap items-center gap-2.5 text-[12px] font-bold text-texte-muet">
          <Link href="/marketplace" className="text-texte-muet no-underline hover:text-carmin">
            Marketplace
          </Link>
          <span className="text-charbon-400">/</span>
          <span>{t("breadcrumbItem")}</span>
          <span className="text-charbon-400">/</span>
          <span className="text-texte-doux">{t("breadcrumbStep")}</span>
        </nav>

        <div className="animate-fade-up mt-3.5">
          <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold tracking-[3px] text-or uppercase">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8b23a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t("heroKicker")}
          </div>
          <h1 className="font-display text-[clamp(34px,5vw,56px)] leading-[0.92] -skew-x-3 uppercase [text-shadow:4px_4px_0_var(--color-carmin)]">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-[700px] text-[13.5px] leading-relaxed font-semibold text-texte-muet">{t("heroDesc")}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-3.5">
            <button
              type="button"
              onClick={() => setSecured(true)}
              className={[
                "relative overflow-hidden rounded-[18px] border-2 p-5 text-left transition",
                secured ? "border-statut-succes bg-statut-succes/[0.06]" : "border-charbon-500 bg-charbon-800",
              ].join(" ")}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_0%,rgba(94,217,154,0.1),transparent_55%)]" />
              <div className="relative flex items-start gap-3.5">
                <RadioDot active={secured} color="#5ed99a" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-[21px] -skew-x-3 uppercase">{t("securedTitle")}</span>
                    <span className="rounded-md bg-statut-succes/15 px-2 py-1 text-[9px] font-black tracking-wide text-statut-succes uppercase">
                      {t("recommended")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed font-semibold text-texte-muet">{t("securedDesc")}</p>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {PERKS.map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-statut-succes/15 text-[10px] font-black text-statut-succes">
                          ✓
                        </span>
                        <span className="text-[11.5px] font-bold text-texte-doux">{t(k)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[26px] text-or leading-none">+ 2,90 €</div>
                  <div className="mt-1 text-[10px] font-bold text-texte-dim">{t("securedFeeLabel")}</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSecured(false)}
              className={[
                "rounded-[18px] border-2 p-5 text-left transition",
                !secured ? "border-[#ff6b5e] bg-[#ff6b5e]/5" : "border-charbon-500 bg-charbon-800",
              ].join(" ")}
            >
              <div className="flex items-start gap-3.5">
                <RadioDot active={!secured} color="#ff6b5e" />
                <div className="min-w-0 flex-1">
                  <span className="font-display text-[21px] -skew-x-3 uppercase">{t("standardTitle")}</span>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed font-semibold text-texte-muet">{t("standardDesc")}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[#ff8a7e]">⚠</span>
                    <span className="text-[11px] font-bold text-[#ff8a7e]">{t("standardWarning")}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[26px] text-texte-muet leading-none">+ 0 €</div>
                  <div className="mt-1 text-[10px] font-bold text-texte-dim">{t("standardFeeLabel")}</div>
                </div>
              </div>
            </button>

            {secured && (
              <div className="animate-pop rounded-2xl border border-charbon-600 bg-[#16161a] p-5">
                <p className="mb-3.5 text-[12px] font-extrabold text-texte-doux">{t("afterPayment")}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {FLOW.map((f) => (
                    <div key={f.n}>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-display flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] text-[12px]"
                          style={{ borderColor: f.color, color: f.color }}
                        >
                          {f.n}
                        </span>
                        <span className="text-[11px] font-extrabold text-blanc-casse">{t(f.key)}</span>
                      </div>
                      <p className="mt-1.5 pr-2 text-[10px] leading-snug font-bold text-texte-dim">{t(`${f.key}Desc`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="sticky top-6 flex flex-col gap-3.5">
            <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
              <div className="flex items-center gap-3">
                <img
                  src="/uploads/35_NISSAN_S13_KOUKI.jpg"
                  alt=""
                  className="aspect-[5/7] w-14 rounded-[9px] object-cover shadow-[0_8px_18px_rgba(0,0,0,0.5)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("soldBy")}</div>
                  <div className="mt-0.5 text-[14px] leading-snug font-extrabold">{t("demoCard")}</div>
                  <div className="mt-0.5 text-[11px] font-bold text-texte-muet">◈ Rare · {t("demoCondition")}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-charbon-500 pt-4 text-[12.5px]">
                <Row label={t("lineCard")} value={fmt(cardPrice)} />
                <Row label={t("lineShipping")} value={fmt(shipping)} />
                <Row label={t("lineSecure")} value={secured ? fmt(secureFee) : t("lineSecureNone")} accent={secured} />
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-charbon-500 pt-3.5">
                <span className="font-display text-[15px] tracking-wide uppercase">Total</span>
                <span className="font-display text-[26px] text-or">{fmt(total)}</span>
              </div>
            </div>

            {secured && (
              <div className="animate-pop rounded-2xl border border-[rgba(99,91,255,0.3)] bg-gradient-to-br from-[rgba(99,91,255,0.1)] to-charbon-800 p-4">
                <p className="text-[12px] font-extrabold text-blanc-casse">{t("cautionTitle")}</p>
                <p className="mt-2 text-[11px] leading-relaxed font-bold text-texte-muet">{t("cautionDesc")}</p>
              </div>
            )}

            <Link href="/securite/envoi" className="block no-underline">
              <span className="font-display flex w-full -skew-x-3 items-center justify-center gap-2 rounded-[13px] bg-carmin py-4 text-[15px] tracking-[1.2px] text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition hover:bg-carmin-alt hover:-translate-x-0.5 hover:-translate-y-0.5">
                <span className="inline-block skew-x-3">{secured ? t("ctaSecured") : t("ctaStandard")} →</span>
              </span>
            </Link>
            <p className="px-1 text-[10.5px] leading-relaxed font-semibold text-texte-dim">{t("footerHint")}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function RadioDot({ active, color }: { active: boolean; color: string }) {
  return (
    <span
      className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: active ? color : "#5a5a64" }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? color : "transparent" }} />
    </span>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between font-semibold">
      <span className="text-texte-corps">{label}</span>
      <span className={`font-extrabold ${accent === false ? "text-texte-dim" : "text-blanc-casse"}`}>{value}</span>
    </div>
  );
}
