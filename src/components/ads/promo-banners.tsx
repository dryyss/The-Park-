"use client";

import { useState, useEffect } from "react";
import { cardImage } from "@/lib/rarity";

interface PromoSlide {
  id: string;
  label: string | null;
  title: string;
  subtitle: string | null;
  cta: string | null;
  color: string;
  href: string;
  position: string;
  imageUrl: string | null;
}

const ROTATE_INTERVAL_MS = 4500;

/** Récupère les bannières actives d'un emplacement donné + gère la rotation. */
function useBannerSlides(position: string) {
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch("/api/banners")
      .then((r) => r.json())
      .then((data: PromoSlide[]) => setSlides(data.filter((b) => b.position === position)))
      .catch(() => {});
  }, [position]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  return { slides, current: current % Math.max(slides.length, 1), setCurrent };
}

function Dots({ slides, current, setCurrent, color }: { slides: PromoSlide[]; current: number; setCurrent: (i: number) => void; color: string }) {
  if (slides.length <= 1) return null;
  return (
    <div className="flex gap-1">
      {slides.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={(e) => { e.preventDefault(); setCurrent(i); }}
          className="h-1 w-5 overflow-hidden rounded transition-all"
          style={{ background: i === current ? color : "#333" }}
          aria-label={`Pub ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Coin d'écran (overlay flottant) — placements bottom-left | bottom-right
// ---------------------------------------------------------------------------

function BannerWidget({ slides, position }: { slides: PromoSlide[]; position: "bottom-left" | "bottom-right" }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setAnimating(false);
      }, 280);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!visible || slides.length === 0) return null;

  const slide = slides[current];
  const posClass = position === "bottom-left"
    ? "left-4 bottom-24 md:bottom-6"
    : "right-4 bottom-24 md:bottom-6";

  return (
    <div
      className={`fixed z-40 w-[220px] overflow-hidden rounded-[14px] border bg-charbon-900 shadow-[0_8px_32px_rgba(0,0,0,0.55)] transition-all ${posClass}`}
      style={{ borderColor: `${slide.color}55` }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: `${slide.color}22` }}
      >
        <span
          className="font-display text-[8px] tracking-[2.5px] uppercase"
          style={{ color: slide.color }}
        >
          {slide.label ?? "PUB"}
        </span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-2 text-[10px] text-texte-faible transition hover:text-blanc-casse"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <a
        href={slide.href}
        className={`block transition-opacity ${animating ? "opacity-0" : "opacity-100"}`}
        style={{ transitionDuration: "250ms" }}
      >
        {slide.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardImage(slide.imageUrl)} alt={slide.title} className="h-[88px] w-full object-cover" />
        )}
        <div className="px-3 py-3">
          <div className="font-display text-[15px] leading-tight tracking-[1px] text-blanc-casse">
            {slide.title}
          </div>
          {slide.subtitle && (
            <div className="mt-0.5 text-[10.5px] text-texte-faible">{slide.subtitle}</div>
          )}
          {slide.cta && (
            <div className="mt-2 text-[10.5px] font-extrabold" style={{ color: slide.color }}>
              {slide.cta}
            </div>
          )}
        </div>
      </a>

      {slides.length > 1 && (
        <div className="px-3 pb-2.5">
          <Dots slides={slides} current={current} setCurrent={setCurrent} color={slide.color} />
        </div>
      )}
    </div>
  );
}

export function PromoBannerCorner({ position = "bottom-left" }: { position?: "bottom-left" | "bottom-right" }) {
  const { slides } = useBannerSlides(position);
  return <BannerWidget slides={slides} position={position} />;
}

// ---------------------------------------------------------------------------
//  Bandeau horizontal (leaderboard) — placement "top"
// ---------------------------------------------------------------------------

export function PromoBannerStrip({ className = "" }: { className?: string }) {
  const { slides, current, setCurrent } = useBannerSlides("top");
  if (slides.length === 0) return null;
  const s = slides[current];

  return (
    <a
      href={s.href}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[14px] border bg-charbon-900 px-3 py-2.5 transition hover:bg-charbon-800 sm:gap-4 sm:px-5 sm:py-3 ${className}`}
      style={{ borderColor: `${s.color}44` }}
    >
      <span
        className="font-display shrink-0 rounded px-1.5 py-0.5 text-[8px] tracking-[2.5px] uppercase"
        style={{ background: `${s.color}22`, color: s.color }}
      >
        {s.label ?? "PUB"}
      </span>

      {s.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cardImage(s.imageUrl)} alt={s.title} className="h-10 w-16 shrink-0 rounded-md object-cover sm:h-12 sm:w-20" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[14px] leading-tight tracking-[0.5px] text-blanc-casse sm:text-[16px]">
          {s.title}
        </div>
        {s.subtitle && <div className="truncate text-[11px] text-texte-faible sm:text-[12px]">{s.subtitle}</div>}
      </div>

      <div className="hidden shrink-0 sm:block">
        <Dots slides={slides} current={current} setCurrent={setCurrent} color={s.color} />
      </div>

      {s.cta && (
        <span
          className="font-display shrink-0 -skew-x-3 rounded-lg px-3.5 py-2 text-[11px] tracking-[1px] text-white uppercase transition group-hover:opacity-90 sm:text-[12px]"
          style={{ background: s.color }}
        >
          {s.cta}
        </span>
      )}
    </a>
  );
}

// ---------------------------------------------------------------------------
//  Panneau latéral (rail) — placement "side"
// ---------------------------------------------------------------------------

export function PromoBannerRail({ className = "" }: { className?: string }) {
  const { slides, current, setCurrent } = useBannerSlides("side");
  if (slides.length === 0) return null;
  const s = slides[current];

  return (
    <aside
      className={`overflow-hidden rounded-[16px] border bg-charbon-900 ${className}`}
      style={{ borderColor: `${s.color}44` }}
    >
      <div className="flex items-center justify-between px-4 py-2" style={{ background: `${s.color}1f` }}>
        <span className="font-display text-[8px] tracking-[2.5px] uppercase" style={{ color: s.color }}>
          {s.label ?? "PUB"}
        </span>
        <Dots slides={slides} current={current} setCurrent={setCurrent} color={s.color} />
      </div>

      <a href={s.href} className="block transition hover:opacity-95">
        {s.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardImage(s.imageUrl)} alt={s.title} className="aspect-4/3 w-full object-cover" />
        )}
        <div className="px-4 py-4">
          <div className="font-display text-[17px] leading-tight tracking-[0.5px] text-blanc-casse">{s.title}</div>
          {s.subtitle && <div className="mt-1 text-[12px] text-texte-faible">{s.subtitle}</div>}
          {s.cta && (
            <span
              className="font-display mt-3 inline-block -skew-x-3 rounded-lg px-4 py-2 text-[11px] tracking-[1px] text-white uppercase"
              style={{ background: s.color }}
            >
              {s.cta}
            </span>
          )}
        </div>
      </a>
    </aside>
  );
}
