"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

type SeasonTab = { id: string; code: string; name: string };
type SeasonPct = { code: string; pct: number };

/**
 * Onglets de saison (garage). La page collection est `force-dynamic` : un clic
 * déclenche un aller-retour serveur complet, ce qui donnait une impression de
 * clic « pas pris en compte ». On applique donc l'état actif de façon optimiste
 * (surbrillance immédiate) + un état de chargement pendant la navigation.
 */
export function SeasonTabs({
  seasons,
  seasonPcts,
  activeSeason,
  activeEdition,
  horsSerieCode,
  labels,
}: {
  seasons: SeasonTab[];
  seasonPcts: SeasonPct[];
  activeSeason: string | null;
  activeEdition: "first" | "reprint" | null;
  horsSerieCode: string;
  labels: { seasonHS: string; editionBadge1st: string; editionBadgeReprint: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Cible de navigation optimiste : ce que l'utilisateur vient de cliquer.
  // `null` = « toutes les saisons » (désélection). `undefined` = rien en attente.
  const go = (href: string) => {
    startTransition(() => router.push(href));
  };

  return (
    <div
      className={`flex w-full flex-wrap items-center justify-end gap-2 pb-1.5 transition-opacity sm:w-auto ${
        pending ? "opacity-60" : ""
      }`}
    >
      {seasons.map((s) => {
        const isHS = s.code === horsSerieCode;
        const isActive = activeSeason === s.code;
        const href = isActive ? "/collection" : `/collection?season=${s.code}`;
        const sp = seasonPcts.find((p) => p.code === s.code);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => go(href)}
            disabled={pending}
            className={[
              "font-display flex flex-col items-center rounded-lg px-4.5 py-2 text-[13px] tracking-[1.5px] transition",
              isActive
                ? "bg-blanc-casse text-charbon shadow-[3px_3px_0_var(--color-carmin)]"
                : isHS
                  ? "border border-dashed border-carmin/50 text-carmin hover:bg-carmin/10"
                  : "border border-dashed border-charbon-400 text-texte-faible hover:border-charbon-300 hover:text-blanc-casse",
            ].join(" ")}
          >
            <span>{isHS ? labels.seasonHS : s.name}</span>
            {sp && (
              <span
                className={`mt-0.5 text-[9px] font-extrabold tracking-wide tabular-nums ${
                  isActive ? "text-charbon/60" : "text-texte-faible"
                }`}
              >
                {sp.pct}%
              </span>
            )}
          </button>
        );
      })}
      {activeSeason && (
        <div className="ml-2 mt-0.5 flex gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              go(
                activeEdition === "first"
                  ? `/collection?season=${activeSeason}`
                  : `/collection?season=${activeSeason}&edition=first`,
              )
            }
            className="px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] transition"
            style={{
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))",
              background: activeEdition === "first" || activeEdition === null ? "var(--color-carmin)" : "#3a3a3a",
              color: activeEdition === "first" || activeEdition === null ? "#fff" : "var(--color-texte-faible)",
            }}
          >
            {labels.editionBadge1st}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              go(
                activeEdition === "reprint"
                  ? `/collection?season=${activeSeason}`
                  : `/collection?season=${activeSeason}&edition=reprint`,
              )
            }
            className="px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] transition"
            style={{
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))",
              background: activeEdition === "reprint" ? "var(--color-carmin)" : "#3a3a3a",
              color: activeEdition === "reprint" ? "#fff" : "var(--color-texte-faible)",
            }}
          >
            {labels.editionBadgeReprint}
          </button>
        </div>
      )}
    </div>
  );
}
