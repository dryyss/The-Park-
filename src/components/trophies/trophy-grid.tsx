import { getTranslations } from "next-intl/server";
import type { TrophyBadge } from "@/server/trophy/trophy.service";

export async function TrophyGrid({ badges, unlocked, total, pct }: { badges: TrophyBadge[]; unlocked: number; total: number; pct: number }) {
  const t = await getTranslations("trophies");

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end gap-6 rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
        <div>
          <p className="text-[12px] font-extrabold tracking-[3px] text-carmin uppercase">{t("progress")}</p>
          <p className="font-display mt-1 text-[42px] leading-none text-or">
            {unlocked}/{total}
          </p>
        </div>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-charbon-700">
            <div className="h-full rounded-full bg-or transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[12px] font-bold text-texte-dim">{t("pct", { pct })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.code}
            className={`rounded-[16px] border p-5 text-center transition ${b.unlocked ? "border-or/40 bg-charbon-700" : "border-charbon-500 bg-charbon-800 opacity-50 grayscale"}`}
          >
            <div className={`font-display mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[22px] ${b.unlocked ? "bg-or text-charbon" : "bg-charbon-600 text-texte-faible"}`}>
              {b.icon}
            </div>
            <p className="mt-3 text-[13px] font-extrabold text-blanc-casse">{b.label}</p>
            <p className="mt-1 text-[11px] font-bold text-texte-dim">{b.description}</p>
            {b.unlocked && b.unlockedAt && (
              <p className="mt-2 text-[10px] font-bold text-or">
                {t("unlockedOn", { date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(b.unlockedAt) })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
