"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { RarityStripItem } from "./rarity-strip";

const BARREL_RADIUS = 300;
const ANGLE_PER_SLOT = 44;
const DRAG_SENSITIVITY = 140;
const ACTIVE_SCALE = 1.18;
const SIDE_SCALE_BASE = 0.88;

type RarityCarouselProps = {
  rarities: RarityStripItem[];
  /** Affiche « X cartes possédées » au lieu du décompte catalogue. */
  showOwned?: boolean;
};

function RarityScrollBar({
  items,
  active,
  onChange,
  ariaLabel,
  swipeHint,
  showMobileHint,
}: {
  items: RarityStripItem[];
  active: number;
  onChange: (index: number) => void;
  ariaLabel: string;
  swipeHint: string;
  showMobileHint: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbDrag = useRef<{ startX: number; startIndex: number; pointerId: number } | null>(null);
  const [thumbDragging, setThumbDragging] = useState(false);
  const count = items.length;
  const max = Math.max(count - 1, 0);
  const pct = max === 0 ? 0 : active / max;
  const activeColor = items[active]?.color ?? "#D6004F";

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || max === 0) return active;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * max);
    },
    [active, max],
  );

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    onChange(indexFromClientX(e.clientX));
    thumbDrag.current = { startX: e.clientX, startIndex: active, pointerId: e.pointerId };
    setThumbDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!thumbDragging || thumbDrag.current?.pointerId !== e.pointerId) return;
    const track = trackRef.current;
    if (!track || max === 0) return;
    const rect = track.getBoundingClientRect();
    const deltaSteps = ((e.clientX - thumbDrag.current.startX) / rect.width) * max;
    const next = Math.round(thumbDrag.current.startIndex + deltaSteps);
    onChange(Math.max(0, Math.min(max, next)));
  };

  const endThumbDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!thumbDragging || thumbDrag.current?.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    thumbDrag.current = null;
    setThumbDragging(false);
  };

  if (count <= 1) return null;

  return (
    <div className="mx-auto mt-4 max-w-[min(100%,420px)] px-4 md:mt-6">
      {showMobileHint && (
        <>
          <div className="mb-3 flex items-center justify-center gap-2 md:hidden">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-charbon-500 bg-charbon-800/90 text-[15px] text-carmin"
              aria-hidden
            >
              ‹
            </span>
            <span
              className="inline-flex h-9 w-9 animate-rarity-swipe items-center justify-center rounded-full border border-carmin/40 bg-carmin/10 text-[18px] text-blanc-casse"
              aria-hidden
            >
              ↔
            </span>
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-charbon-500 bg-charbon-800/90 text-[15px] text-carmin"
              aria-hidden
            >
              ›
            </span>
          </div>
          <p className="mb-2 text-center text-[11px] font-bold tracking-[0.5px] text-texte-dim md:hidden">{swipeHint}</p>
        </>
      )}
      <div
        ref={trackRef}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={active}
        aria-valuetext={items[active]?.label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(Math.max(0, active - 1));
          if (e.key === "ArrowRight") onChange(Math.min(max, active + 1));
        }}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endThumbDrag}
        onPointerCancel={endThumbDrag}
        className={[
          "relative h-2.5 rounded-full bg-charbon-600/90",
          thumbDragging ? "cursor-grabbing" : "cursor-pointer",
        ].join(" ")}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-35 transition-[width] duration-300"
          style={{ width: `${pct * 100}%`, background: activeColor }}
        />
        <div
          className={[
            "absolute top-1/2 h-4 w-10 -translate-y-1/2 rounded-full border border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-[left,background-color] duration-300",
            thumbDragging ? "cursor-grabbing scale-105" : "cursor-grab hover:scale-105",
          ].join(" ")}
          style={{
            left: `calc(${pct * 100}% - 20px)`,
            background: activeColor,
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold tracking-[1px] text-texte-faible uppercase">
        <span>{items[0]?.label}</span>
        <span>{items[max]?.label}</span>
      </div>
    </div>
  );
}

// Carrousel « barillet » : glisser horizontalement (souris ou touch) pour faire tourner
// les raretés ; la carte centrée est mise en avant.
export function RarityCarousel({ rarities, showOwned = false }: RarityCarouselProps) {
  const t = useTranslations("home");
  const items = rarities.slice(0, 6);
  const [active, setActive] = useState(Math.min(2, Math.max(0, items.length - 1)));
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [hintHidden, setHintHidden] = useState(false);
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
    setHintHidden(true);
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

  const stageCursor = isDragging ? "cursor-grabbing" : "cursor-grab";

  return (
    <div className="relative select-none">
      <div
        className={[
          "relative mx-auto h-[340px] max-w-[920px] overflow-visible touch-none sm:touch-pan-y",
          stageCursor,
        ].join(" ")}
        style={{ perspective: "1200px" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {items.map((r, i) => {
            const slotOffset = i - active + dragOffset;
            const abs = Math.abs(slotOffset);
            const isActive = abs < 0.5;
            const hidden = abs > 3.2;
            const angle = slotOffset * ANGLE_PER_SLOT;
            const transition = ready && !isDragging ? "transform 0.5s ease-out, opacity 0.5s ease-out" : "none";
            const sideScale = SIDE_SCALE_BASE - Math.max(0, abs - 1) * 0.06;

            return (
              <button
                type="button"
                key={r.label}
                onClick={() => {
                  if (Math.abs(dragOffset) > 0.08) return;
                  setHintHidden(true);
                  setActive(i);
                }}
                aria-label={r.label}
                aria-current={isActive}
                tabIndex={hidden ? -1 : 0}
                className={[
                  "absolute top-1/2 left-1/2 origin-center focus:outline-none",
                  hidden ? "pointer-events-none" : "cursor-pointer",
                ].join(" ")}
                style={{
                  transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${BARREL_RADIUS}px) scale(${
                    isActive ? ACTIVE_SCALE : sideScale
                  })`,
                  opacity: hidden ? 0 : isActive ? 1 : Math.max(0.55, 0.82 - abs * 0.12),
                  zIndex: Math.round(30 - abs * 10),
                  transition,
                  backfaceVisibility: "hidden",
                }}
              >
                <div
                  className="flex h-[240px] w-[196px] flex-col items-center justify-center gap-3 rounded-[28px] border bg-charbon-800 px-5 text-center sm:h-[260px] sm:w-[210px]"
                  style={{
                    borderColor: isActive ? r.color : `${r.color}66`,
                    boxShadow: isActive
                      ? `0 0 56px ${r.color}66, inset 0 0 40px ${r.color}24`
                      : `0 8px 28px rgba(0,0,0,0.35), inset 0 0 20px ${r.color}12`,
                    filter: isActive ? "none" : `brightness(${Math.max(0.82, 0.95 - abs * 0.06)}) saturate(0.92)`,
                    transition: ready && !isDragging ? "border-color 0.5s, box-shadow 0.5s, filter 0.5s" : "none",
                  }}
                >
                  <div
                    className={[
                      "grid place-items-center rounded-full leading-none",
                      isActive ? "h-[72px] w-[72px] text-[38px]" : "h-[60px] w-[60px] text-[30px]",
                    ].join(" ")}
                    style={{ color: r.color, background: `${r.color}22` }}
                  >
                    {r.glyph}
                  </div>
                  <div
                    className={[
                      "font-extrabold tracking-[1px] text-blanc-casse uppercase",
                      isActive ? "text-[15px]" : "text-[13px]",
                    ].join(" ")}
                  >
                    {r.label}
                  </div>
                  <div className="text-[12px] font-bold text-texte-dim">{countLabel(r.count)}</div>
                </div>
              </button>
            );
          })}
        </div>

        {!hintHidden && (
          <div
            className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-charbon-500/80 bg-charbon-900/90 px-3 py-1.5 text-[11px] font-bold text-texte-dim shadow-lg backdrop-blur-sm md:hidden"
            aria-hidden
          >
            <span className="animate-rarity-swipe text-[15px] text-carmin">↔</span>
            <span>{t("raritySwipeHint")}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setHintHidden(true);
          go(-1);
        }}
        aria-label={t("rarityPrev")}
        className="absolute top-[42%] left-2 z-20 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-charbon-400 bg-charbon-900/80 text-[20px] text-blanc-casse backdrop-blur transition-colors duration-150 hover:border-carmin hover:text-carmin sm:left-4"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => {
          setHintHidden(true);
          go(1);
        }}
        aria-label={t("rarityNext")}
        className="absolute top-[42%] right-2 z-20 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-charbon-400 bg-charbon-900/80 text-[20px] text-blanc-casse backdrop-blur transition-colors duration-150 hover:border-carmin hover:text-carmin sm:right-4"
      >
        ›
      </button>

      <RarityScrollBar
        items={items}
        active={active}
        onChange={(i) => {
          setHintHidden(true);
          setActive(i);
        }}
        ariaLabel={t("rarityScroll")}
        swipeHint={t("raritySwipeHint")}
        showMobileHint={!hintHidden}
      />
    </div>
  );
}
