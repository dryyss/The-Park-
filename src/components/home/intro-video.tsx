"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Vidéo de présentation sur l'accueil, en bandeau immersif plein écran
 * (pleine largeur, hauteur de viewport, sans bordure).
 *
 * Au chargement : lecture automatique en sourdine + boucle (décor d'accueil).
 * Une flèche pilote l'expérience :
 *   - flèche vers le haut → relance la vidéo depuis 0, avec le son ;
 *   - flèche vers le bas  → remet à 0, met en pause et coupe le son.
 * Si la source ne peut pas être décodée, on masque proprement.
 */
export function IntroVideo({ url, posterUrl }: { url: string; posterUrl: string | null }) {
  const t = useTranslations("home");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    if (!active) {
      // Flèche vers le haut : on (re)lance avec le son.
      video.muted = false;
      void video.play();
      setActive(true);
    } else {
      // Flèche vers le bas : retour au repos silencieux.
      video.muted = true;
      video.pause();
      setActive(false);
    }
  }

  if (failed) return null;

  return (
    <section className="relative h-svh min-h-105 w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={url}
        poster={posterUrl ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      >
        {t("introVideoNoSupport")}
      </video>

      {/* Voile dégradé : garde le titre lisible sans masquer la vidéo. */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-black/40" />

      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
        <p className="text-carmin text-[12px] font-bold tracking-[4px] uppercase">{t("introVideoKicker")}</p>
        <h2 className="font-display text-blanc-casse mt-2 -skew-x-3 text-[clamp(28px,6vw,56px)] leading-[1.05] uppercase drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          {t("introVideoTitle")}
        </h2>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label={active ? t("introVideoMute") : t("introVideoUnmute")}
        className="bg-carmin hover:bg-carmin-alt absolute bottom-8 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:scale-110"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-6 w-6 transition-transform duration-300 ${active ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
    </section>
  );
}
