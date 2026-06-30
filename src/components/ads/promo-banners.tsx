"use client";

import { useState, useEffect } from "react";

interface PromoSlide {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  cta: string;
  color: string;
  href: string;
}

const PLACEHOLDER_SLIDES: PromoSlide[] = [
  {
    id: "1",
    label: "NOUVEAUTÉ",
    title: "Pack Nuit Tokyo",
    subtitle: "Disponible dès maintenant",
    cta: "Découvrir →",
    color: "var(--color-carmin)",
    href: "/catalogue",
  },
  {
    id: "2",
    label: "ENCHÈRES",
    title: "Drift King ★",
    subtitle: "Enchère en cours · fin dans 2h",
    cta: "Enchérir →",
    color: "var(--color-or)",
    href: "/encheres",
  },
  {
    id: "3",
    label: "OFFRE SPÉCIALE",
    title: "−15% sur les packs",
    subtitle: "Jusqu'au 31 juillet 2026",
    cta: "Profiter →",
    color: "#7c5cfc",
    href: "/boutique",
  },
];

const ROTATE_INTERVAL_MS = 4500;

export function PromoBannerCorner({ position = "bottom-left" }: { position?: "bottom-left" | "bottom-right" }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % PLACEHOLDER_SLIDES.length);
        setAnimating(false);
      }, 280);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (!visible) return null;

  const slide = PLACEHOLDER_SLIDES[current];
  const posClass = position === "bottom-left"
    ? "left-4 bottom-24 md:bottom-6"
    : "right-4 bottom-24 md:bottom-6";

  return (
    <div
      className={`fixed z-40 w-[220px] overflow-hidden rounded-[14px] border bg-charbon-900 shadow-[0_8px_32px_rgba(0,0,0,0.55)] transition-all ${posClass}`}
      style={{ borderColor: `${slide.color}55` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: `${slide.color}22` }}
      >
        <span
          className="font-display text-[8px] tracking-[2.5px] uppercase"
          style={{ color: slide.color }}
        >
          {slide.label}
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

      {/* Body */}
      <a
        href={slide.href}
        className={`block px-3 py-3 transition-opacity ${animating ? "opacity-0" : "opacity-100"}`}
        style={{ transitionDuration: "250ms" }}
      >
        <div
          className="font-display text-[15px] leading-tight tracking-[1px] text-blanc-casse"
        >
          {slide.title}
        </div>
        <div className="mt-0.5 text-[10.5px] text-texte-faible">{slide.subtitle}</div>
        <div
          className="mt-2 text-[10.5px] font-extrabold"
          style={{ color: slide.color }}
        >
          {slide.cta}
        </div>
      </a>

      {/* Progress dots */}
      <div className="flex gap-1 px-3 pb-2.5">
        {PLACEHOLDER_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setCurrent(i)}
            className="h-1 flex-1 overflow-hidden rounded transition-all"
            style={{ background: i === current ? slide.color : "#333" }}
            aria-label={`Pub ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
