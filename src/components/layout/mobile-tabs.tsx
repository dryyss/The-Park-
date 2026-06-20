"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

function Tab({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={["flex flex-col items-center gap-1", active ? "text-carmin" : "text-texte-dim"].join(" ")}>
      {children}
      <span className="text-[9px] font-extrabold">{label}</span>
    </Link>
  );
}

export function MobileTabs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const is = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-charbon-500 bg-charbon/[0.92] px-3.5 pt-3 pb-7 backdrop-blur-md md:hidden">
      <Tab href="/" label={t("home")} active={is("/")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      </Tab>
      <Tab href="/collection" label={t("collection")} active={is("/collection")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </Tab>
      <Link
        href="/drop"
        aria-label="Drop"
        className="-mt-[22px] flex h-[52px] w-[52px] -rotate-[4deg] items-center justify-center rounded-2xl bg-carmin shadow-[0_8px_18px_rgba(216,27,96,0.45)]"
      >
        <span className="text-2xl">🎴</span>
      </Link>
      <Tab href="/echanges" label={t("exchanges")} active={is("/echanges")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </Tab>
      <Tab href="/profil" label={t("profile")} active={is("/profil")}>
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-linear-to-br from-carmin to-rouge-fonce font-display text-[11px] text-white">
          K
        </span>
      </Tab>
    </nav>
  );
}
