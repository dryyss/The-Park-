"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Marqueur de session — volontairement dans `sessionStorage` et non
 * `localStorage` : il s'efface à la fermeture du navigateur, donc l'intro
 * rejoue à la visite suivante, mais survit à la navigation interne. Un membre
 * qui revient sur l'accueil en cours de session ne la resubit pas.
 */
const SEEN_KEY = "the-park:intro-video-seen";

/**
 * Vidéo d'intro plein écran, à l'ouverture du site.
 *
 * Trois garde-fous, parce qu'une intro qui s'impose est vite une intro qu'on
 * subit : elle ne se joue qu'une fois par session, elle est interruptible à
 * tout moment (bouton, Échap, fin de lecture), et elle ne se déclenche pas du
 * tout si le système demande de limiter les animations.
 *
 * Le démarrage est muet : les navigateurs refusent la lecture automatique avec
 * son, et une vidéo bloquée en pause serait pire que pas d'intro du tout. Le son
 * s'active d'un clic.
 */
export function IntroOverlay({ url, posterUrl }: { url: string; posterUrl: string | null }) {
  const t = useTranslations("home");
  // Démarre masqué : le serveur ne rend rien, donc pas d'écart d'hydratation, et
  // l'intro n'apparaît qu'une fois la décision prise côté client.
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Stockage refusé : tant pis, l'intro se rejouera à la prochaine page.
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    // `?intro=1` rejoue l'intro à la demande, sans attendre une nouvelle session :
    // indispensable pour relire un rendu qu'on vient de modifier ou le montrer à
    // quelqu'un dans la foulée.
    const forced = new URLSearchParams(window.location.search).get("intro") === "1";
    if (!forced) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      try {
        if (sessionStorage.getItem(SEEN_KEY)) return;
      } catch {
        return;
      }
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    // La page ne doit pas défiler derrière l'intro.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    skipRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("introVideoTitle")}
      className="bg-charbon fixed inset-0 z-[100] flex items-center justify-center"
    >
      <video
        ref={videoRef}
        src={url}
        poster={posterUrl ?? undefined}
        autoPlay
        muted={muted}
        playsInline
        onEnded={dismiss}
        // Si la vidéo ne peut pas démarrer (réseau, format), on ne laisse pas le
        // visiteur devant un écran noir : on efface l'intro.
        onError={dismiss}
        className="h-full w-full object-contain"
      />

      <div className="absolute right-4 bottom-4 flex gap-2 sm:right-6 sm:bottom-6">
        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m);
            if (videoRef.current) videoRef.current.muted = !muted;
          }}
          className="border-charbon-400 text-blanc-casse rounded-full border bg-black/50 px-4 py-2 text-[12px] font-extrabold uppercase backdrop-blur transition hover:border-white"
        >
          {muted ? t("introVideoUnmute") : t("introVideoMute")}
        </button>
        <button
          ref={skipRef}
          type="button"
          onClick={dismiss}
          className="bg-carmin font-display rounded-full px-5 py-2 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
        >
          {t("introVideoSkip")}
        </button>
      </div>
    </div>
  );
}
