import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroCardFan } from "@/components/home/hero-card-fan";
import type { CardDisplay } from "@/server/catalog/catalog.service";

export async function HeroSection({ heroCards }: { heroCards: CardDisplay[] }) {
  const t = await getTranslations("home");

  return (
    <section className="page-container relative grid grid-cols-1 items-center gap-8 pt-12 pb-10 sm:gap-10 sm:pt-[70px] sm:pb-[50px] lg:grid-cols-[1.05fr_1fr] lg:gap-8">
      <div className="font-jp pointer-events-none absolute top-2.5 right-0 hidden text-[210px] leading-none font-black text-blanc-casse/3 select-none lg:block">
        駐車場
      </div>
      <div
        className="pointer-events-none absolute top-[-120px] left-[-180px] h-[560px] w-[560px]"
        style={{ background: "radial-gradient(circle, rgba(216,27,96,0.22), transparent 65%)" }}
      />

      <div className="animate-fade-up relative">
        <div className="mb-4 text-[12px] font-bold tracking-[4px] text-carmin uppercase">{t("heroKicker")}</div>
        <h1 className="font-display wrap-break-word text-[clamp(40px,9vw,88px)] leading-[0.95] tracking-[1px] skew-x-[-4deg] uppercase text-blanc-casse">
          {t("heroTitleLine1")}
          <br />
          <span className="text-carmin [text-shadow:4px_4px_0_rgba(242,239,233,0.92)]">{t("heroTitleLine2")}</span>
        </h1>
        <p className="mt-[22px] max-w-[480px] text-[16.5px] leading-[1.65] text-texte-corps">
          {t.rich("heroIntro", { b: (c) => <strong className="text-blanc-casse">{c}</strong> })}
        </p>
        <div className="mt-[30px] flex flex-wrap gap-3">
          <Link
            href="/collection"
            className="font-display inline-block skew-x-[-3deg] rounded-[10px] bg-carmin px-[26px] py-[15px] text-[15px] tracking-[1.5px] text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition hover:bg-carmin-alt"
          >
            {t("ctaCollection")}
          </Link>
          <Link
            href="/marketplace"
            className="font-display inline-block skew-x-[-3deg] rounded-[10px] border-[1.5px] border-charbon-400 px-[26px] py-[15px] text-[15px] tracking-[1.5px] text-blanc-casse uppercase transition hover:border-carmin"
          >
            {t("ctaMarketplace")}
          </Link>
        </div>
      </div>

      <div className="animate-fade-up [animation-delay:0.15s] lg:min-h-[500px]">
        <HeroCardFan cards={heroCards} />
      </div>
    </section>
  );
}
