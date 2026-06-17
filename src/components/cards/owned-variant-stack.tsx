"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HoloCard, type HoloVariant } from "@/components/cards/holo-card";

export type StackCard = {
  variantId: string;
  image: string;
  label: string;
  editionLabel: string | null;
  isFirstEdition: boolean;
};

/**
 * Pile des exemplaires possédés (variante + édition). La carte active est au
 * premier plan (avec effet holo) ; les autres sont empilées derrière et passent
 * devant avec une animation au clic / via les pastilles.
 */
export function OwnedVariantStack({
  cards,
  fallbackImage,
  alt,
  tilt,
  holo,
  variant,
  rarityColor,
  priority,
}: {
  cards: StackCard[];
  fallbackImage: string;
  alt: string;
  tilt: number;
  holo: number;
  variant: HoloVariant;
  rarityColor: string;
  priority?: boolean;
}) {
  const t = useTranslations("card");
  // Par défaut : la 1ère édition est au-dessus.
  const initial = Math.max(0, cards.findIndex((c) => c.isFirstEdition));
  const [active, setActive] = useState(initial === -1 ? 0 : initial);

  // 0 ou 1 exemplaire : pas de pile, simple carte.
  if (cards.length <= 1) {
    const only = cards[0];
    return (
      <HoloCard
        src={only?.image ?? fallbackImage}
        alt={alt}
        tilt={tilt}
        holo={holo}
        variant={variant}
        priority={priority}
      />
    );
  }

  const n = cards.length;
  const activeCard = cards[active];

  return (
    <div>
      <div className="relative aspect-[5/7] w-full [perspective:1200px]">
        {cards.map((c, i) => {
          const offset = (i - active + n) % n;
          const isFront = offset === 0;
          const wrapperStyle: React.CSSProperties = {
            transform: isFront
              ? "translate3d(0,0,0)"
              : `translate3d(${offset * 16}px, ${-offset * 12}px, 0) rotate(${offset * 3.5}deg) scale(${1 - offset * 0.05})`,
            opacity: isFront ? 1 : Math.max(0.25, 1 - offset * 0.3),
            zIndex: n - offset,
            transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease",
          };

          if (isFront) {
            return (
              <div key={c.variantId} className="absolute inset-0" style={wrapperStyle}>
                <HoloCard
                  src={c.image}
                  alt={`${alt} · ${c.label}`}
                  tilt={tilt}
                  holo={holo}
                  variant={variant}
                  priority={priority}
                  className="h-full w-full"
                />
              </div>
            );
          }

          return (
            <button
              key={c.variantId}
              type="button"
              onClick={() => setActive(i)}
              aria-label={c.label}
              className="absolute inset-0 cursor-pointer overflow-hidden rounded-xl bg-charbon-700 shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
              style={wrapperStyle}
            >
              <Image src={c.image} alt={c.label} fill sizes="380px" className="object-cover brightness-[0.6]" />
            </button>
          );
        })}
      </div>

      {/* Légende de la carte active */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[12px] font-extrabold">
        <span className="text-blanc-casse">{activeCard.label}</span>
        {activeCard.editionLabel && (
          <span className="rounded bg-carmin/15 px-2 py-0.5 text-[10.5px] tracking-wide text-carmin">
            {activeCard.editionLabel}
          </span>
        )}
      </div>

      {/* Pastilles de sélection */}
      <div className="mt-2.5 flex items-center justify-center gap-2">
        {cards.map((c, i) => (
          <button
            key={c.variantId}
            type="button"
            onClick={() => setActive(i)}
            aria-label={c.label}
            aria-current={i === active}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 22 : 8,
              background: i === active ? rarityColor : "#3a3a42",
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-texte-faible">{t("stackHint")}</p>
    </div>
  );
}
