"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ScrollToTopButton() {
  const t = useTranslations("collection");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={t("backToTop")}
      title={t("backToTop")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed right-6 bottom-24 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-charbon-400 bg-charbon-800/95 text-blanc-casse shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-carmin hover:text-white lg:bottom-8"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
