"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SkewButton } from "@/components/ui/skew-button";
import { cardImage } from "@/lib/rarity";

type Step = 0 | 1 | 2 | 3;

const FLOAT_CARDS = [
  { src: "/uploads/54_NISSAN_S15_ICONIQUE.jpg", rot: "-8deg", delay: "0s", size: "w-[min(26vw,116px)] sm:w-[116px]" },
  { src: "/uploads/76_TOYOTA_COROLLA_TRUENO.jpg", rot: "0deg", delay: "0.6s", size: "w-[min(30vw,128px)] sm:w-[128px]", lift: true },
  { src: "/uploads/64_PORSCHE_911_RWB.jpg", rot: "8deg", delay: "1.2s", size: "w-[min(26vw,116px)] sm:w-[116px]" },
];

const REGIONS = [
  { k: "JP", kanji: "日本", label: "Japon", sub: "JDM, drift, touge", accent: "#ff2e63" },
  { k: "DE", kanji: "独逸", label: "Allemagne", sub: "BMW, Porsche…", accent: "#4fa3ff" },
  { k: "US", kanji: "米国", label: "USA", sub: "Muscle, V8", accent: "#e8b23a" },
] as const;

const BRANDS = ["nissan", "toyota", "mazda", "bmw", "honda", "porsche", "subaru", "mercedes"] as const;

const GOALS = [
  { k: "collect", icon: "🗂️" },
  { k: "trade", icon: "⇄" },
  { k: "sell", icon: "🏷️" },
] as const;

const PULL = [
  { name: "NISSAN SILVIA S15 SPEC-R", img: "/uploads/04-NISSAN_S15_SPECR.jpg", rar: "c", color: "#9ba3b2", glyph: "◆", label: "Commune" },
  { name: "NISSAN SKYLINE R33 NISMO", img: "/uploads/33_Nissan_R33_nismo.jpg", rar: "r", color: "#4fa3ff", glyph: "◈", label: "Rare" },
  { name: "NISSAN SILVIA S15 ULTIME", img: "/uploads/54_NISSAN_S15_ICONIQUE.jpg", rar: "u", color: "#b05cff", glyph: "✦", label: "Ultra Rare" },
];

export function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState<Step>(0);
  const [regions, setRegions] = useState<string[]>(["JP"]);
  const [brands, setBrands] = useState<string[]>(["nissan"]);
  const [goal, setGoal] = useState("collect");
  const [opened, setOpened] = useState(false);

  function toggleRegion(k: string) {
    setRegions((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function toggleBrand(k: string) {
    setBrands((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function openBooster() {
    try {
      localStorage.setItem("thepark_onboarded", "1");
    } catch {
      /* ignore */
    }
    setOpened(true);
  }

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] flex-col overflow-hidden bg-charbon-900 text-blanc-casse">
      <div className="pointer-events-none absolute top-[-160px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(216,27,96,0.16),transparent_62%)]" />
      <div className="font-jp pointer-events-none absolute bottom-[-50px] left-[30px] text-[220px] leading-none font-black text-blanc-casse/[0.025] select-none">
        始
      </div>

      <div className="relative z-[2] flex shrink-0 items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 -rotate-[4deg] overflow-hidden rounded-[9px] bg-blanc-casse shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            <Image src="/uploads/pasted-1781200672492-0.png" alt="The Park" width={40} height={40} className="h-full w-full scale-110 object-cover" />
          </span>
          <div>
            <div className="font-display text-[18px] tracking-[1.5px]">THE PARK</div>
            <div className="font-jp mt-0.5 text-[9px] font-bold tracking-[3px] text-carmin">駐車場 · DRIFT/JDM</div>
          </div>
        </div>
        <Link href="/" className="text-[12.5px] font-extrabold text-texte-dim transition hover:text-carmin">
          {t("skip")} →
        </Link>
      </div>

      {step >= 1 && step <= 3 && (
        <div className="relative z-[2] mx-auto flex w-full max-w-[420px] gap-2 px-4 sm:px-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-sm transition ${step >= i ? "bg-carmin" : "bg-charbon-600"}`} />
          ))}
        </div>
      )}

      <div className="relative z-[2] flex flex-1 items-center justify-center p-4 sm:p-7">
        {step === 0 && (
          <div className="animate-fade-up max-w-[640px] text-center">
            <div className="mb-7 flex justify-center gap-2 sm:mb-9 sm:gap-4">
              {FLOAT_CARDS.map((c) => (
                <div
                  key={c.src}
                  className={`animate-floaty ${c.size} ${c.lift ? "-mt-2 sm:-mt-3.5" : ""}`}
                  style={{ ["--rot" as string]: c.rot, animationDelay: c.delay }}
                >
                  <div className="relative aspect-[5/7] overflow-hidden rounded-xl border border-white/10 shadow-[0_18px_36px_rgba(0,0,0,0.6)]">
                    <Image src={c.src} alt="" fill className="object-cover" sizes="128px" />
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="absolute top-[-20%] left-0 h-[140%] w-[40%] bg-gradient-to-r from-transparent via-white/35 to-transparent [animation:sheen_4.5s_ease-in-out_infinite]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] font-bold tracking-[4px] text-carmin uppercase">{t("welcomeKicker")}</p>
            <h1 className="font-display mt-4 text-[clamp(42px,6.5vw,74px)] leading-[0.9] -skew-x-6 uppercase">
              {t("welcomeTitle1")}
              <br />
              <span className="text-carmin [text-shadow:4px_4px_0_rgba(242,239,233,0.92)]">{t("welcomeTitle2")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[440px] text-[15px] leading-relaxed text-texte-corps">{t("welcomeDesc")}</p>
            <div className="mt-8">
              <SkewButton className="px-9 py-4 text-[15px]" onClick={() => setStep(1)}>
                {t("welcomeCta")} →
              </SkewButton>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-pop w-full max-w-[620px]">
            <p className="text-[11.5px] font-bold tracking-[3px] text-carmin uppercase">{t("step1of3")}</p>
            <h2 className="font-display mt-2.5 text-[clamp(30px,4vw,44px)] -skew-x-3 uppercase [text-shadow:3px_3px_0_var(--color-carmin)]">
              {t("sceneTitle")}
            </h2>
            <p className="mt-1 mb-6 text-[14px] text-texte-muet">{t("sceneDesc")}</p>

            <p className="mb-2.5 text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("regionsLabel")}</p>
            <div className="mb-5 flex flex-wrap gap-3">
              {REGIONS.map((r) => {
                const on = regions.includes(r.k);
                return (
                  <button
                    key={r.k}
                    type="button"
                    onClick={() => toggleRegion(r.k)}
                    className={[
                      "flex min-w-[140px] flex-1 items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-4 text-left transition",
                      on ? "border-carmin bg-carmin/10" : "border-charbon-500 bg-charbon-800",
                    ].join(" ")}
                  >
                    <span className="font-jp text-[22px] font-black" style={{ color: r.accent }}>
                      {r.kanji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[15px] tracking-wide">{r.label}</div>
                      <div className="text-[11px] font-bold text-texte-muet">{r.sub}</div>
                    </div>
                    <span
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] text-[12px] text-white",
                        on ? "border-carmin bg-carmin" : "border-charbon-400 bg-transparent",
                      ].join(" ")}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mb-2.5 text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("brandsLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {BRANDS.map((b) => {
                const on = brands.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBrand(b)}
                    className={[
                      "font-display rounded-full border-[1.5px] px-4 py-2.5 text-[13px] tracking-wide uppercase transition",
                      on ? "border-carmin bg-carmin text-white" : "border-charbon-500 bg-charbon-800 text-texte-doux",
                    ].join(" ")}
                  >
                    {b}
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex gap-2.5">
              <SkewButton variant="outline" onClick={() => setStep(0)}>
                {t("back")}
              </SkewButton>
              <SkewButton className="flex-1 py-4" onClick={() => setStep(2)}>
                {t("continue")}
              </SkewButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-pop w-full max-w-[640px]">
            <p className="text-[11.5px] font-bold tracking-[3px] text-carmin uppercase">{t("step2of3")}</p>
            <h2 className="font-display mt-2.5 text-[clamp(30px,4vw,44px)] -skew-x-3 uppercase [text-shadow:3px_3px_0_var(--color-carmin)]">
              {t("goalTitle")}
            </h2>
            <p className="mt-1 mb-6 text-[14px] text-texte-muet">{t("goalDesc")}</p>
            <div className="flex flex-col gap-3">
              {GOALS.map((g) => {
                const on = goal === g.k;
                return (
                  <button
                    key={g.k}
                    type="button"
                    onClick={() => setGoal(g.k)}
                    className={[
                      "flex items-center gap-4 rounded-2xl border-[1.5px] px-5 py-4 text-left transition hover:translate-x-0.5",
                      on ? "border-carmin bg-carmin/10" : "border-charbon-500 bg-charbon-800",
                    ].join(" ")}
                  >
                    <span className="flex h-[50px] w-[50px] items-center justify-center rounded-[13px] border border-charbon-500 bg-charbon text-[23px]">
                      {g.icon}
                    </span>
                    <div className="flex-1">
                      <div className="font-display text-[16px] tracking-wide">{t(`goals.${g.k}.title`)}</div>
                      <div className="mt-0.5 text-[12px] font-bold text-texte-muet">{t(`goals.${g.k}.sub`)}</div>
                    </div>
                    <span
                      className={[
                        "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                        on ? "border-carmin" : "border-charbon-400",
                      ].join(" ")}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${on ? "bg-carmin" : "bg-transparent"}`} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-7 flex gap-2.5">
              <SkewButton variant="outline" onClick={() => setStep(1)}>
                {t("back")}
              </SkewButton>
              <SkewButton className="flex-1 py-4" onClick={() => setStep(3)}>
                {t("continue")}
              </SkewButton>
            </div>
          </div>
        )}

        {step === 3 && !opened && (
          <div className="animate-pop w-full max-w-[680px] text-center">
            <p className="text-[11.5px] font-bold tracking-[3px] text-carmin uppercase">{t("step3of3")}</p>
            <h2 className="font-display mt-3 text-[clamp(30px,4vw,46px)] -skew-x-3 uppercase [text-shadow:3px_3px_0_var(--color-carmin)]">
              {t("boosterTitle")}
            </h2>
            <p className="mt-1 text-[14px] text-texte-muet">{t("boosterDesc")}</p>
            <button type="button" onClick={openBooster} className="relative mx-auto mt-6 inline-block cursor-pointer">
              <div className="pointer-events-none absolute inset-[-30px] animate-[glowPulse_2.2s_ease-in-out_infinite] bg-[radial-gradient(circle,rgba(216,27,96,0.35),transparent_68%)]" />
              <div className="animate-shake relative mx-auto w-[min(52vw,210px)]">
                <div className="relative aspect-[3/4.4] overflow-hidden rounded-2xl border-[1.5px] border-carmin/50 shadow-[0_26px_54px_rgba(0,0,0,0.7)]">
                  <Image src="/uploads/booster-1.png" alt="" fill className="object-cover" sizes="210px" />
                </div>
              </div>
            </button>
            <div className="mt-8">
              <SkewButton className="px-9 py-4 text-[15px]" onClick={openBooster}>
                {t("boosterOpen")}
              </SkewButton>
            </div>
          </div>
        )}

        {step === 3 && opened && (
          <div className="animate-pop w-full max-w-[680px] text-center">
            <h2 className="font-display mt-3 text-[clamp(30px,4vw,46px)] -skew-x-3 uppercase [text-shadow:3px_3px_0_var(--color-carmin)]">
              {t("pulledTitle")}
            </h2>
            <p className="mt-1 mb-7 text-[14px] text-texte-muet">{t("pulledDesc")}</p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {PULL.map((p, i) => (
                <div
                  key={p.name}
                  className="w-[min(42vw,150px)] sm:w-[150px]"
                  style={{ animation: `revealCard 0.55s ${(i * 0.18 + 0.1).toFixed(2)}s cubic-bezier(0.2,0.8,0.3,1) both` }}
                >
                  <div className="relative aspect-[5/7] overflow-hidden rounded-[13px] border-2 shadow-[0_18px_40px_rgba(0,0,0,0.6)]" style={{ borderColor: p.color }}>
                    <Image src={cardImage(p.img)} alt={p.name} fill className="object-cover" sizes="150px" />
                    <span className="font-display absolute top-1.5 left-1.5 rounded-md bg-black/72 px-2 py-0.5 text-[10px]" style={{ color: p.color }}>
                      {p.glyph} {p.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-snug font-extrabold">{p.name}</p>
                </div>
              ))}
            </div>
            <Link href="/collection" className="mt-8 inline-block no-underline">
              <span className="font-display inline-flex -skew-x-3 items-center justify-center gap-2 rounded-[12px] bg-carmin px-9 py-4 text-[15px] tracking-[1.5px] text-white uppercase shadow-[5px_5px_0_rgba(0,0,0,0.5)] transition hover:bg-carmin-alt hover:-translate-x-0.5 hover:-translate-y-0.5">
                <span className="inline-block skew-x-3">{t("enterPark")} →</span>
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
