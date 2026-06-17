import { getTranslations } from "next-intl/server";
import { HoloCard } from "@/components/cards/holo-card";
import { Link } from "@/i18n/navigation";
import type { CardDisplay } from "@/server/catalog/catalog.service";

interface HeroStats {
  totalCards: number;
  rarityCount: number;
  versionCount: number;
  uniqueCount: number;
}

const POSITIONS = [
  "top-[60px] left-[4%] z-1 w-[215px] [--rot:-9deg]",
  "top-2 left-[31%] z-3 w-[240px] [--rot:1deg] [animation-delay:0.6s]",
  "top-[80px] left-[62%] z-2 w-[215px] [--rot:10deg] [animation-delay:1.2s]",
];

export async function HeroSection({ stats, heroCards }: { stats: HeroStats; heroCards: CardDisplay[] }) {
  const t = await getTranslations("home");

  const statItems = [
    { v: stats.totalCards, l: t("statCards"), gold: false },
    { v: stats.rarityCount, l: t("statRarities"), gold: false },
    { v: stats.versionCount, l: t("statVersions"), gold: false },
    { v: stats.uniqueCount, l: t("statUnique"), gold: true },
  ];

  return (
    <section className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-10 px-7 pt-[70px] pb-[50px] lg:grid-cols-[1.05fr_1fr]">
      <div className="font-jp pointer-events-none absolute top-2.5 right-0 hidden text-[210px] leading-none font-black text-blanc-casse/3 select-none lg:block">
        駐車場
      </div>
      <div
        className="pointer-events-none absolute top-[-120px] left-[-180px] h-[560px] w-[560px]"
        style={{ background: "radial-gradient(circle, rgba(216,27,96,0.22), transparent 65%)" }}
      />

      <div className="animate-fade-up relative">
        <div className="mb-4 text-[12px] font-bold tracking-[4px] text-carmin uppercase">{t("heroKicker")}</div>
        <h1 className="font-display text-[clamp(52px,6.5vw,88px)] leading-[0.95] tracking-[1px] skew-x-[-4deg] uppercase text-blanc-casse">
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
        <div className="mt-[38px] flex flex-wrap gap-7">
          {statItems.map((s) => (
            <div key={s.l}>
              <div className={["font-display text-[26px]", s.gold ? "text-carmin" : "text-blanc-casse"].join(" ")}>{s.v}</div>
              <div className="text-[11.5px] font-bold tracking-[1.5px] text-texte-dim uppercase">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cartes flottantes (3 plus cotées) */}
      <div className="animate-fade-up relative hidden h-[480px] lg:block">
        {heroCards.slice(0, 3).map((card, i) => (
          <div key={card.slug} className={`animate-floaty absolute ${POSITIONS[i]}`}>
            <HoloCard src={card.image} alt={card.name} tilt={card.tilt} holo={card.holo} variant={card.variant} rarityColor={card.color} priority={i < 2} />
            {card.isUnique && (
              <span className="font-display absolute top-[-12px] right-[-14px] rotate-[4deg] rounded-md bg-carmin px-3 py-1.5 text-[11px] tracking-[1.5px] text-white shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
                CARTE UNIQUE ✪
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
