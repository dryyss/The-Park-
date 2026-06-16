"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RarityStripItem } from "./rarity-strip";

// Carrousel "coverflow" : la carte centrée est agrandie et mise en avant,
// les cartes latérales sont réduites et atténuées. Cliquer une carte (ou les
// flèches / points) la ramène au centre.
export function RarityCarousel({ rarities }: { rarities: RarityStripItem[] }) {
  const t = useTranslations("home");
  const items = rarities.slice(0, 6);
  const [active, setActive] = useState(Math.min(2, Math.max(0, items.length - 1)));

  if (items.length === 0) return null;

  const go = (dir: number) => setActive((a) => (a + dir + items.length) % items.length);

  return (
    <div className="relative select-none">
      <div className="relative mx-auto flex h-[280px] max-w-[820px] items-center justify-center overflow-hidden">
        {items.map((r, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          const isActive = offset === 0;
          const hidden = abs > 2;

          return (
            <button
              type="button"
              key={r.label}
              onClick={() => setActive(i)}
              aria-label={r.label}
              aria-current={isActive}
              tabIndex={hidden ? -1 : 0}
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-500 ease-out focus:outline-none"
              style={{
                transform: `translate(-50%, -50%) translateX(${offset * 168}px) scale(${
                  isActive ? 1 : 0.78 - (abs - 1) * 0.08
                })`,
                opacity: hidden ? 0 : isActive ? 1 : 0.5 - (abs - 1) * 0.18,
                zIndex: 10 - abs,
                pointerEvents: hidden ? "none" : "auto",
              }}
            >
              <div
                className="flex h-[220px] w-[180px] flex-col items-center justify-center gap-3 rounded-[26px] border bg-charbon-800 px-5 text-center transition-[border-color,box-shadow] duration-500"
                style={{
                  borderColor: isActive ? r.color : "#3a3a42",
                  boxShadow: isActive
                    ? `0 0 44px ${r.color}55, inset 0 0 32px ${r.color}1f`
                    : "none",
                  filter: isActive ? "none" : "brightness(0.7) saturate(0.85)",
                }}
              >
                <div
                  className="grid h-[64px] w-[64px] place-items-center rounded-full text-[34px] leading-none"
                  style={{ color: r.color, background: `${r.color}1a` }}
                >
                  {r.glyph}
                </div>
                <div className="text-[14px] font-extrabold tracking-[1px] text-blanc-casse uppercase">
                  {r.label}
                </div>
                <div className="text-[12px] font-bold text-texte-dim">{t("rarityCount", { count: r.count })}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label={t("rarityPrev")}
        className="absolute top-1/2 left-2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-charbon-400 bg-charbon-900/80 text-[20px] text-blanc-casse backdrop-blur transition-colors duration-150 hover:border-carmin hover:text-carmin sm:left-4"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label={t("rarityNext")}
        className="absolute top-1/2 right-2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-charbon-400 bg-charbon-900/80 text-[20px] text-blanc-casse backdrop-blur transition-colors duration-150 hover:border-carmin hover:text-carmin sm:right-4"
      >
        ›
      </button>

      <div className="mt-5 flex items-center justify-center gap-2">
        {items.map((r, i) => (
          <button
            type="button"
            key={r.label}
            onClick={() => setActive(i)}
            aria-label={r.label}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 24 : 8,
              background: i === active ? r.color : "#3a3a42",
            }}
          />
        ))}
      </div>
    </div>
  );
}
