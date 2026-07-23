"use client";

import Image from "next/image";
import { useState } from "react";
import { HoloCard, type HoloVariant } from "@/components/cards/holo-card";

export type EditionView = {
  edition: "first" | "reprint";
  label: string;
  image: string;
  owned: boolean;
};

/**
 * Grande image de la carte + sélecteur d'éditions (1ère édition / réédition).
 * Cliquer une édition change l'art affiché. Les éditions possédées sont mises
 * en avant. S'il n'existe qu'une seule édition, aucun sélecteur n'est rendu.
 */
export function CardEditionViewer({
  editions,
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
  editions: EditionView[];
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
  // Par défaut : la 1ère édition est affichée si présente.
  const initial = Math.max(0, editions.findIndex((e) => e.edition === "first"));
  const [active, setActive] = useState(initial);
  const activeEdition = editions[active];

  return (
    <div>
      <HoloCard
        src={activeEdition?.image ?? fallbackImage}
        alt={activeEdition ? `${alt} · ${activeEdition.label}` : alt}
        tilt={tilt}
        holo={holo}
        variant={variant}
        interactive
        priority={priority}
      />

      {editions.length > 1 && (
        <div className="mt-4">
          <div className="mb-2.5 text-[11px] font-extrabold tracking-[2.5px] text-texte-dim uppercase">{title}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {editions.map((e, i) => {
              const isActive = i === active;
              return (
                <button
                  key={e.edition}
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
                    <Image src={e.image} alt="" fill sizes="36px" className={isActive ? "object-cover" : "object-cover brightness-[0.7]"} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[12.5px] font-extrabold ${isActive ? "text-blanc-casse" : "text-texte-dim"}`}>
                      {e.label}
                    </span>
                    <span className={`mt-0.5 block text-[10.5px] font-bold ${e.owned ? "text-statut-succes" : "text-texte-faible"}`}>
                      {e.owned ? `✓ ${ownedLabel}` : missingLabel}
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
