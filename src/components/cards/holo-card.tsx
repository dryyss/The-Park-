"use client";

import Image from "next/image";
import { useRef } from "react";
import type { HoloVariant } from "@/lib/rarity";

export type { HoloVariant };

const GLARE = "radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.5), rgba(255,255,255,0) 42%)";
const RAINBOW =
  "conic-gradient(from 30deg at var(--mx,50%) var(--my,50%), rgba(255,46,99,0.4), rgba(255,209,102,0.4), rgba(111,227,208,0.4), rgba(79,163,255,0.4), rgba(176,92,255,0.4), rgba(255,46,99,0.4))";
const GOLD =
  "radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,236,170,0.7), rgba(232,178,58,0.15) 55%), linear-gradient(115deg, rgba(232,178,58,0.3), rgba(255,255,255,0.08))";

interface HoloCardProps {
  src: string;
  alt: string;
  tilt?: number;
  holo?: number;
  variant?: HoloVariant;
  priority?: boolean;
  className?: string;
  objectFit?: "cover" | "contain";
  /** Désactive tilt + overlay holographique (grilles catalogue/collection). */
  interactive?: boolean;
}

export function HoloCard({
  src,
  alt,
  tilt = 6,
  holo = 0.6,
  variant = "rainbow",
  priority,
  className,
  objectFit = "cover",
  interactive = false,
}: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    el.style.transform = `perspective(900px) rotateY(${((px - 0.5) * 2 * tilt).toFixed(2)}deg) rotateX(${(-(py - 0.5) * 2 * tilt).toFixed(2)}deg) scale(1.04)`;
    el.style.setProperty("--ho", String(holo));
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.setProperty("--ho", "0");
  };

  const overlayBg = variant === "gold" ? GOLD : variant === "rainbow" ? `${GLARE}, ${RAINBOW}` : undefined;
  const blend = variant === "gold" ? "screen" : "overlay";
  const showOverlay = interactive && variant !== "none";
  // Assets catalogue déjà compressés dans /public/uploads — évite l'optimiseur Next (souvent capricieux sur Windows / mozjpeg).
  const unoptimized = src.startsWith("/uploads/") || src.startsWith("http");

  return (
    <div
      ref={ref}
      onMouseMove={interactive ? onMove : undefined}
      onMouseLeave={interactive ? onLeave : undefined}
      className={[
        "relative aspect-[5/7] overflow-hidden rounded-xl bg-charbon-700 shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
        interactive ? "[transition:transform_0.18s_ease-out] [will-change:transform]" : "",
        className ?? "",
      ].join(" ")}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 40vw, 220px"
        priority={priority}
        unoptimized={unoptimized}
        className={objectFit === "contain" ? "object-contain" : "object-cover"}
      />
      {showOverlay && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [opacity:var(--ho,0)] [transition:opacity_0.25s_ease]"
          style={{ mixBlendMode: blend, background: overlayBg }}
        />
      )}
    </div>
  );
}
