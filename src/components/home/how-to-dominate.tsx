import { getTranslations } from "next-intl/server";

const PILLARS = [
  {
    key: "garage" as const,
    icon: "◈",
    iconBg: "rgba(216,27,96,0.12)",
    iconColor: "#ff2e63",
  },
  {
    key: "trade" as const,
    icon: "⚖",
    iconBg: "rgba(232,178,58,0.12)",
    iconColor: "#E8B23A",
  },
  {
    key: "legend" as const,
    icon: "★",
    iconBg: "rgba(176,92,255,0.12)",
    iconColor: "#b05cff",
  },
];

export async function HowToDominate() {
  const t = await getTranslations("home");

  const labels = {
    garage: { title: t("howGarageTitle"), desc: t("howGarageDesc") },
    trade:  { title: t("howTradeTitle"),  desc: t("howTradeDesc")  },
    legend: { title: t("howLegendTitle"), desc: t("howLegendDesc") },
  };

  return (
    <div className="mt-[56px] text-center">
      <h2 className="font-display text-[clamp(20px,3vw,28px)] tracking-[2px] -skew-x-3 uppercase text-blanc-casse [text-shadow:2px_2px_0_var(--color-carmin)]">
        {t("howTitle")}
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {PILLARS.map((p) => {
          const { title, desc } = labels[p.key];
          return (
            <div key={p.key} className="flex flex-col items-center gap-4 rounded-[20px] border border-charbon-500 bg-charbon-800/60 px-6 py-7">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-[14px] text-[26px]"
                style={{ background: p.iconBg, color: p.iconColor }}
              >
                {p.icon}
              </span>
              <div>
                <p className="font-display text-[15px] tracking-[1px] uppercase text-blanc-casse">{title}</p>
                <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-texte-dim">{desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
