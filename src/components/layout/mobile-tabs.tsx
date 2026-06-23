"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@auth0/nextjs-auth0";
import { Link, usePathname } from "@/i18n/navigation";

function Tab({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={["flex min-w-0 flex-1 flex-col items-center gap-0.5 sm:gap-1", active ? "text-carmin" : "text-texte-dim"].join(" ")}>
      {children}
      <span className="max-w-full truncate text-[8.5px] font-extrabold sm:text-[9px]">{label}</span>
    </Link>
  );
}

export function MobileTabs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useUser();
  const is = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  const initial = (user?.name ?? user?.email ?? "K").charAt(0).toUpperCase();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-charbon-500 bg-charbon/[0.92] px-2 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-3.5 sm:pt-3 md:hidden">
      <Tab href="/" label={t("home")} active={is("/")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-[22px] sm:w-[22px]">
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      </Tab>
      <Tab href="/collection" label={t("collection")} active={is("/collection")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-[22px] sm:w-[22px]">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </Tab>
      <Link
        href="/drop"
        aria-label={t("drop")}
        className="-mt-5 flex h-12 w-12 shrink-0 -rotate-[4deg] items-center justify-center rounded-2xl bg-carmin shadow-[0_8px_18px_rgba(216,27,96,0.45)] sm:-mt-[22px] sm:h-[52px] sm:w-[52px]"
      >
        <span className="text-xl sm:text-2xl">🎴</span>
      </Link>
      <Tab href="/echanges" label={t("exchanges")} active={is("/echanges")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-[22px] sm:w-[22px]">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </Tab>
      <Tab href="/profil" label={t("profile")} active={is("/profil")}>
        <span className="font-display flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-carmin to-rouge-fonce text-[10px] text-white sm:h-[22px] sm:w-[22px] sm:text-[11px]">
          {initial}
        </span>
      </Tab>
    </nav>
  );
}
