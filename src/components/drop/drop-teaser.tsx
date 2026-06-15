import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getNextDropEvent } from "@/server/site/site.service";

export async function DropTeaser() {
  const t = await getTranslations("drop");
  const drop = await getNextDropEvent();
  const target = drop?.targetDate ?? new Date("2026-09-01T18:00:00+02:00");

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-charbon-500 bg-charbon-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(214,0,79,0.15),transparent_60%)]" />
      <div className="relative px-8 py-16 text-center md:py-24">
        <p className="text-[12px] font-extrabold tracking-[4px] text-carmin uppercase">{t("kicker")}</p>
        <h2 className="font-display mt-4 text-[clamp(36px,8vw,72px)] leading-[0.95] -skew-x-6 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
          {drop?.name ?? t("title")}
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-[15px] font-semibold leading-relaxed text-texte-dim">{t("desc")}</p>
        <div className="mt-10 inline-flex flex-col items-center gap-2 rounded-[16px] border border-or/30 bg-charbon-700 px-10 py-6">
          <p className="text-[11px] font-extrabold tracking-[3px] text-or uppercase">{t("countdownLabel")}</p>
          <p className="font-mono text-[28px] font-bold text-blanc-casse md:text-[36px]">
            {target.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="text-[12px] font-bold text-texte-faible">
            {target.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} CET
          </p>
        </div>
        <Link
          href="/notifications"
          className="font-display mt-8 inline-block rounded-[12px] bg-carmin px-8 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt"
        >
          {t("notifyCta")}
        </Link>
      </div>
    </div>
  );
}
