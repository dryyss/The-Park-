import { getTranslations } from "next-intl/server";
import type { TrophyBadge } from "@/server/trophy/trophy.service";
import { BADGE_CATEGORIES, badgeCategory, badgeSortIndex } from "@/lib/badges";

export async function TrophyGrid({ badges, unlocked, total, pct }: { badges: TrophyBadge[]; unlocked: number; total: number; pct: number }) {
  const t = await getTranslations("trophies");

  // Regroupe par catégorie, dans l'ordre officiel de la liste client.
  const sorted = [...badges].sort((a, b) => badgeSortIndex(a.code) - badgeSortIndex(b.code));
  const groups = BADGE_CATEGORIES.map((cat) => ({
    cat,
    badges: sorted.filter((b) => badgeCategory(b.code).code === cat.code),
  })).filter((g) => g.badges.length > 0);

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

      {groups.map(({ cat, badges: catBadges }) => (
        <section key={cat.code} className="mt-9 first:mt-0">
          <div className="flex items-center gap-3">
            <span className="text-[20px]">{cat.icon}</span>
            <h2 className="font-display text-[20px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
              {cat.label}
            </h2>
            <span className="text-[11px] font-extrabold text-texte-faible">
              {catBadges.filter((b) => b.unlocked).length}/{catBadges.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {catBadges.map((b) => (
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
        </section>
      ))}
    </div>
  );
}
