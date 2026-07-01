import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FEATURES } from "@/lib/features";

export async function OnboardingSteps() {
  const t = await getTranslations("onboarding");

  const steps = [
    { title: t("step1Title"), desc: t("step1Desc"), href: "/collection" },
    { title: t("step2Title"), desc: t("step2Desc"), href: "/marketplace" },
    ...(FEATURES.exchange ? [{ title: t("step3Title"), desc: t("step3Desc"), href: "/echanges" }] : []),
    { title: t("step4Title"), desc: t("step4Desc"), href: "/boutique" },
  ].map((s, i) => ({ ...s, num: String(i + 1).padStart(2, "0") }));

  return (
    <div className="flex flex-col gap-5">
      {steps.map((s) => (
        <Link
          key={s.num}
          href={s.href}
          className="group flex gap-5 rounded-[18px] border border-charbon-500 bg-charbon-800 p-6 transition hover:border-carmin"
        >
          <span className="font-display shrink-0 text-[36px] leading-none text-carmin/40 group-hover:text-carmin">{s.num}</span>
          <div>
            <h3 className="font-display text-[18px] tracking-wide text-blanc-casse uppercase">{s.title}</h3>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-texte-dim">{s.desc}</p>
          </div>
        </Link>
      ))}
      <p className="text-center text-[12px] font-bold text-texte-faible">{t("skipHint")}</p>
    </div>
  );
}
