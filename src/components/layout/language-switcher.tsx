"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "ja", label: "日本語", short: "日本語" },
  { code: "en", label: "English", short: "EN" },
];

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  function switchTo(code: Locale) {
    setOpen(false);
    if (code === locale) return;
    // Conserve le chemin courant (sans préfixe de langue) et bascule la locale.
    startTransition(() => router.replace(pathname, { locale: code }));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Langue · 言語 · Language"
        aria-label="Langue"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
        className="font-display flex h-[35px] min-w-[35px] items-center justify-center gap-1 rounded-[9px] border border-charbon-500 bg-charbon-800 px-2.5 text-[11px] tracking-[1px] text-texte-doux uppercase transition hover:-translate-y-0.5 hover:border-carmin hover:text-white disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="hidden sm:inline">{current.short}</span>
      </button>

      {open && (
        <>
          {/* Backdrop pour fermer au clic extérieur */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-[150px] overflow-hidden rounded-[11px] border border-charbon-500 bg-charbon-800 py-1 shadow-[0_16px_32px_rgba(0,0,0,0.5)]"
          >
            {LOCALES.map((l) => {
              const active = l.code === locale;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="menuitem"
                  onClick={() => switchTo(l.code)}
                  className={[
                    "flex w-full items-center justify-between px-3.5 py-2 text-left text-[12.5px] font-bold transition",
                    active ? "bg-carmin/12 text-carmin" : "text-texte-doux hover:bg-charbon-700 hover:text-blanc-casse",
                  ].join(" ")}
                >
                  <span>{l.label}</span>
                  <span className="font-display text-[10px] tracking-[1px] text-texte-faible uppercase">{l.short}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
