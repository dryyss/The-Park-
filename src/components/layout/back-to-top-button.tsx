"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SHOW_AFTER_PX = 600;

/** Flèche flottante « remonter en haut » — apparaît après un vrai défilement. */
export function BackToTopButton() {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("backToTop")}
      title={t("backToTop")}
      className="fixed bottom-24 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-charbon-400 bg-charbon-800/90 text-blanc-casse shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition hover:-translate-y-0.5 hover:border-carmin hover:text-carmin md:bottom-6"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
