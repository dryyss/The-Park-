import { getTranslations } from "next-intl/server";
import { HELP_FAQ, type FaqItem } from "@/data/help-faq";
import { FEATURES } from "@/lib/features";

const CATEGORIES = (["collection", "marketplace", "exchanges", "shop", "account"] as const).filter(
  (c) => FEATURES.exchange || c !== "exchanges",
);

export async function HelpFaq() {
  const t = await getTranslations("help");

  return (
    <div className="flex flex-col gap-8">
      {CATEGORIES.map((cat) => {
        const items = HELP_FAQ.filter((f) => f.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="font-display mb-4 text-[20px] tracking-wide text-carmin uppercase">{t(`categories.${cat}`)}</h2>
            <div className="flex flex-col gap-3">
              {items.map((item: FaqItem) => (
                <details key={item.id} className="group rounded-[14px] border border-charbon-500 bg-charbon-800">
                  <summary className="cursor-pointer list-none px-5 py-4 text-[14px] font-extrabold text-blanc-casse marker:hidden [&::-webkit-details-marker]:hidden">
                    {t(item.questionKey)}
                    <span className="float-right text-carmin transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="border-t border-charbon-500 px-5 py-4 text-[13px] font-semibold leading-relaxed text-texte-dim">
                    {t(item.answerKey)}
                  </p>
                </details>
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-center text-[12px] font-bold text-texte-faible">{t("contactHint")}</p>
    </div>
  );
}
