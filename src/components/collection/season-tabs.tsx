"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";

type SeasonTab = { id: string; code: string; name: string };
type SeasonPct = { code: string; pct: number };
type SetTab = { code: string; name: string; pct: number };

/**
 * Onglets de saison (garage) + pastilles de collection. La page collection est
 * `force-dynamic` : un clic déclenche un aller-retour serveur complet, ce qui
 * donnait une impression de clic « pas pris en compte ».
 *
 * Ce sont de vrais liens : le clic fonctionne avant même l'hydratation, pendant
 * une navigation déjà en cours, et au clic milieu. On n'y ajoute aucun `disabled`
 * — désactiver les onglets le temps du chargement faisait purement disparaître
 * les clics émis pendant ce délai. Le seul retour visuel est la surbrillance
 * optimiste de la cible cliquée.
 */
export function SeasonTabs({
  seasons,
  seasonPcts,
  sets,
  horsSerieCode,
  labels,
}: {
  seasons: SeasonTab[];
  seasonPcts: SeasonPct[];
  sets: SetTab[];
  horsSerieCode: string;
  labels: { seasonHS: string };
}) {
  // Les onglets vivent dans le layout du segment : ils survivent au rechargement
  // de la page et lisent donc l'état actif directement dans l'URL.
  const searchParams = useSearchParams();
  const activeSeason = searchParams.get("season");
  const activeSet = searchParams.get("set");

  // Href visé par le dernier clic, pour surligner immédiatement la bonne cible.
  const [target, setTarget] = useState<string | null>(null);

  // La navigation a abouti : on repasse la main aux props serveur.
  useEffect(() => {
    setTarget(null);
  }, [activeSeason, activeSet]);

  // Les deux axes se cumulent : une collection pioche dans plusieurs saisons,
  // la croiser avec une saison reste une lecture valide du classeur.
  const href = (next: { season?: string | null; set?: string | null }) => {
    const season = next.season !== undefined ? next.season : activeSeason;
    const set = next.set !== undefined ? next.set : activeSet;
    const qs = new URLSearchParams();
    if (season) qs.set("season", season);
    if (set) qs.set("set", set);
    const query = qs.toString();
    return query ? `/collection?${query}` : "/collection";
  };

  const seasonHref = (code: string) => href({ season: activeSeason === code ? null : code });
  const setHref = (code: string) => href({ set: activeSet === code ? null : code });

  /** Actif = cible cliquée si une navigation est en cours, sinon l'état serveur. */
  const isTargeted = (target_: string, fallback: boolean) =>
    target === null ? fallback : target === target_;

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 pb-1.5 sm:w-auto">
      {seasons.map((s) => {
        const isHS = s.code === horsSerieCode;
        const h = seasonHref(s.code);
        const isActive = isTargeted(h, activeSeason === s.code);
        const sp = seasonPcts.find((p) => p.code === s.code);
        return (
          <Link
            key={s.id}
            href={h}
            onClick={() => setTarget(h)}
            aria-current={isActive ? "page" : undefined}
            className={[
              "font-display flex flex-col items-center rounded-lg px-4.5 py-2 text-[13px] tracking-[1.5px] transition-colors",
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
          </Link>
        );
      })}
      {sets.length > 0 && (
        <div className="mt-0.5 ml-2 flex flex-wrap gap-1">
          {sets.map((s) => {
            const h = setHref(s.code);
            // Aucune pastille active tant qu'aucun filtre n'est posé : sans
            // `?set=`, le serveur affiche toutes les déclinaisons confondues.
            const on = isTargeted(h, activeSet === s.code);
            return (
              <Link
                key={s.code}
                href={h}
                onClick={() => setTarget(h)}
                aria-current={on ? "page" : undefined}
                className="px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] transition-colors"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))",
                  background: on ? "var(--color-carmin)" : "#3a3a3a",
                  color: on ? "#fff" : "var(--color-texte-faible)",
                }}
              >
                {s.name} {s.pct}%
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
