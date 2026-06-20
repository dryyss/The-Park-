"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { RarityStripItem } from "./rarity-strip";

const BARREL_RADIUS = 260;
const ANGLE_PER_SLOT = 52;
const DRAG_SENSITIVITY = 140;

type RarityCarouselProps = {
  rarities: RarityStripItem[];
  /** Affiche « X cartes possédées » au lieu du décompte catalogue. */
  showOwned?: boolean;
};

// Carrousel « barillet » : glisser horizontalement (souris ou touch) pour faire tourner
// les raretés ; la carte centrée est mise en avant.
export function RarityCarousel({ rarities, showOwned = false }: RarityCarouselProps) {
  const t = useTranslations("home");
  const items = rarities.slice(0, 6);
  const [active, setActive] = useState(Math.min(2, Math.max(0, items.length - 1)));
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const dragRef = useRef({ startX: 0, pointerId: -1 });

  useEffect(() => {
    setReady(true);
  }, []);

  const snapFromDrag = useCallback(
    (offset: number) => {
      if (Math.abs(offset) < 0.18) return;
      const steps = Math.round(offset);
      if (steps !== 0) {
        setActive((a) => (a - steps + items.length * 8) % items.length);
      }
    },
    [items.length],
  );

  if (items.length === 0) return null;

  const go = (dir: number) => setActive((a) => (a + dir + items.length) % items.length);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, pointerId: e.pointerId };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragRef.current.pointerId !== e.pointerId) return;
    const delta = e.clientX - dragRef.current.startX;
    setDragOffset(-delta / DRAG_SENSITIVITY);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragRef.current.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    snapFromDrag(dragOffset);
    setDragOffset(0);
    setIsDragging(false);
    dragRef.current.pointerId = -1;
  };

  const countLabel = (count: number) =>
    showOwned ? t("rarityOwnedCount", { count }) : t("rarityCount", { count });

  return (
    <div className="relative select-none">
      <div
        className="relative mx-auto h-[280px] max-w-[820px] touch-pan-y overflow-hidden"
        style={{ perspective: "1100px" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
        >
          {items.map((r, i) => {
            const slotOffset = i - active + dragOffset;
            const abs = Math.abs(slotOffset);
            const isActive = abs < 0.5;
            const hidden = abs > 2.4;
            const angle = slotOffset * ANGLE_PER_SLOT;
            const transition = ready && !isDragging ? "transform 0.5s ease-out, opacity 0.5s ease-out" : "none";

            return (
              <button
                type="button"
                key={r.label}
                onClick={() => {
                  if (Math.abs(dragOffset) > 0.08) return;
                  setActive(i);
                }}
                aria-label={r.label}
                aria-current={isActive}
                tabIndex={hidden ? -1 : 0}
                className="absolute top-1/2 left-1/2 origin-center focus:outline-none"
                style={{
                  transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${BARREL_RADIUS}px) scale(${
                    isActive ? 1 : 0.78 - Math.max(0, abs - 1) * 0.07
                  })`,
                  opacity: hidden ? 0 : isActive ? 1 : 0.48 - Math.max(0, abs - 1) * 0.16,
                  zIndex: Math.round(20 - abs * 10),
                  pointerEvents: hidden ? "none" : "auto",
                  transition,
                  backfaceVisibility: "hidden",
                }}
              >
                <div
                  className="flex h-[220px] w-[180px] flex-col items-center justify-center gap-3 rounded-[26px] border bg-charbon-800 px-5 text-center"
                  style={{
                    borderColor: isActive ? r.color : "#3a3a42",
                    boxShadow: isActive
                      ? `0 0 44px ${r.color}55, inset 0 0 32px ${r.color}1f`
                      : "none",
                    filter: isActive ? "none" : "brightness(0.7) saturate(0.85)",
                    transition: ready && !isDragging ? "border-color 0.5s, box-shadow 0.5s, filter 0.5s" : "none",
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
                  <div className="text-[12px] font-bold text-texte-dim">{countLabel(r.count)}</div>
                </div>
              </button>
            );
          })}
        </div>
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
