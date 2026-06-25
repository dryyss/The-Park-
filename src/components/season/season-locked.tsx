import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getLockedSeason } from "@/server/site/site.service";

export async function SeasonLockedTeaser() {
  const t = await getTranslations("season2");
  const season = await getLockedSeason("S02");

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-charbon-500 bg-charbon-800">
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-charbon/75 backdrop-blur-sm">
        <div className="text-center">
          <span className="font-display text-[64px] text-blanc-casse/20">🔒</span>
          <p className="font-display mt-2 text-[24px] tracking-[2px] text-blanc-casse uppercase">{t("locked")}</p>
          {season?.releaseDate && (
            <p className="mt-2 text-[13px] font-bold text-or">
              {season.releaseDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
      <div className="px-8 py-20 opacity-40 select-none">
        <p className="text-[12px] font-extrabold tracking-[4px] text-carmin uppercase">{t("kicker")}</p>
        <h2 className="font-display mt-3 text-[48px] -skew-x-6 uppercase text-blanc-casse">{season?.name ?? t("title")}</h2>
        <p className="mt-4 max-w-md text-[14px] font-semibold text-texte-dim">{t("teaser")}</p>
      </div>
      <div className="relative border-t border-charbon-500 px-8 py-6 text-center">
        <p className="text-[13px] font-bold text-texte-dim">{t("hint")}</p>
        <Link href="/saison-1" className="mt-3 inline-block text-[13px] font-extrabold text-carmin hover:underline">
          {t("backS1")}
        </Link>
      </div>
    </div>
  );
}
