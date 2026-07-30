"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Vidéo de présentation sur l'accueil, en bandeau immersif plein écran
 * (pleine largeur, hauteur de viewport, sans bordure).
 *
 * Lecture automatique en sourdine + boucle : c'est un décor d'accueil, pas un
 * lecteur classique. Le son s'active d'un clic (les navigateurs refusent
 * l'autoplay sonore). Si la source ne peut pas être décodée (format, réseau),
 * on masque proprement au lieu de laisser un écran noir.
 */
export function IntroVideo({ url, posterUrl }: { url: string; posterUrl: string | null }) {
  const t = useTranslations("home");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }

  if (failed) return null;

  return (
    <section className="relative h-svh min-h-105 w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={url}
        poster={posterUrl ?? undefined}
        autoPlay
        muted={muted}
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-10 text-center sm:pb-14">
        <p className="text-carmin text-[12px] font-bold tracking-[4px] uppercase">{t("introVideoKicker")}</p>
        <h2 className="font-display text-blanc-casse mt-2 -skew-x-3 text-[clamp(28px,6vw,56px)] leading-[1.05] uppercase drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          {t("introVideoTitle")}
        </h2>
      </div>

      <button
        type="button"
        onClick={toggleMute}
        className="border-charbon-400 text-blanc-casse absolute right-4 bottom-4 rounded-full border bg-black/50 px-4 py-2 text-[12px] font-extrabold uppercase backdrop-blur transition hover:border-white sm:right-6 sm:bottom-6"
      >
        {muted ? t("introVideoUnmute") : t("introVideoMute")}
      </button>
    </section>
  );
}
