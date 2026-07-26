"use client";

import Image from "next/image";
import { useState } from "react";
import { HoloCard, type HoloVariant } from "@/components/cards/holo-card";

export type CardSetView = {
  key: string;
  label: string;
  image: string;
  owned: boolean;
};

/**
 * Grande image de la carte + sélecteur de déclinaisons (carte de base et
 * collections). Cliquer une déclinaison change l'art affiché ; celles déjà
 * possédées sont mises en avant. Une seule déclinaison = pas de sélecteur.
 */
export function CardSetViewer({
  sets,
  fallbackImage,
  alt,
  tilt,
  holo,
  variant,
  rarityColor,
  priority,
  title,
  hint,
  ownedLabel,
  missingLabel,
}: {
  sets: CardSetView[];
  fallbackImage: string;
  alt: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  rarityColor: string;
  priority?: boolean;
  title: string;
  hint: string;
  ownedLabel: string;
  missingLabel: string;
}) {
  const [active, setActive] = useState(0);
  const activeSet = sets[active];

  return (
    <div>
      <HoloCard
        src={activeSet?.image ?? fallbackImage}
        alt={activeSet ? `${alt} · ${activeSet.label}` : alt}
        tilt={tilt}
        holo={holo}
        variant={variant}
        interactive
        priority={priority}
      />

      {sets.length > 1 && (
        <div className="mt-4">
          <div className="mb-2.5 text-[11px] font-extrabold tracking-[2.5px] text-texte-dim uppercase">{title}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {sets.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={isActive}
                  className={[
                    "flex items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition",
                    isActive ? "bg-charbon-700" : "border-charbon-500 bg-charbon-800 hover:border-charbon-400",
                  ].join(" ")}
                  style={isActive ? { borderColor: rarityColor } : undefined}
                >
                  <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-charbon-700">
                    <Image src={s.image} alt="" fill sizes="36px" className={isActive ? "object-cover" : "object-cover brightness-[0.7]"} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[12.5px] font-extrabold ${isActive ? "text-blanc-casse" : "text-texte-dim"}`}>
                      {s.label}
                    </span>
                    <span className={`mt-0.5 block text-[10.5px] font-bold ${s.owned ? "text-statut-succes" : "text-texte-faible"}`}>
                      {s.owned ? `✓ ${ownedLabel}` : missingLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[11px] font-bold text-texte-faible">{hint}</p>
        </div>
      )}
    </div>
  );
}
