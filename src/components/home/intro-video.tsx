"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Vidéo de présentation sur l'accueil.
 *
 * Rien de la vidéo n'est téléchargé au chargement de la page : on affiche une
 * vignette, et le `<video>` n'est monté qu'au clic, avec `preload="none"`. Une
 * lecture automatique aurait coûté plusieurs mégaoctets à chaque visite — pour
 * un contenu que la plupart des visiteurs ne regarderont pas — et dégradé le
 * temps d'affichage de la page comme la bande passante de l'hébergement.
 */
export function IntroVideo({ url, posterUrl }: { url: string; posterUrl: string | null }) {
  const t = useTranslations("home");
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <section className="page-container py-10 sm:py-14">
      <div className="mb-5 text-center">
        <p className="text-carmin text-[12px] font-bold tracking-[4px] uppercase">
          {t("introVideoKicker")}
        </p>
        <h2 className="font-display text-blanc-casse mt-2 skew-x-[-3deg] text-[clamp(26px,5vw,44px)] leading-[1.05] uppercase">
          {t("introVideoTitle")}
        </h2>
      </div>

      <div className="border-charbon-500 bg-charbon-900 relative mx-auto aspect-video w-full max-w-[900px] overflow-hidden rounded-[18px] border shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
        {playing ? (
          <video
            ref={videoRef}
            src={url}
            poster={posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
            preload="none"
            className="h-full w-full bg-black"
          >
            {t("introVideoNoSupport")}
          </video>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={t("introVideoPlay")}
            className="group relative block h-full w-full cursor-pointer"
          >
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- visuel hébergé sur Cellar, hors loader Next
              <img
                src={posterUrl}
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <span className="from-charbon-800 to-charbon absolute inset-0 bg-gradient-to-br" />
            )}
            <span className="absolute inset-0 bg-black/35 transition group-hover:bg-black/20" />
            <span className="bg-carmin absolute top-1/2 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition group-hover:scale-110">
              {/* Triangle légèrement décalé : optiquement centré dans le disque. */}
              <span className="ml-1.5 border-y-[14px] border-l-[22px] border-y-transparent border-l-white" />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
