"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoutLink } from "@/components/auth/logout-link";

export function UserMenu({ staffDashboardHref }: { staffDashboardHref?: string | null }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tProfile = useTranslations("profile");
  const tFooter = useTranslations("footer");
  const tAuth = useTranslations("auth");

  const initial = (user?.name ?? user?.email ?? "K").charAt(0).toUpperCase();
  const displayName = user?.name ?? user?.email ?? "";

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!user) return null;

  const itemClass =
    "block w-full px-3.5 py-2.5 text-left text-[12.5px] font-bold text-blanc-casse transition hover:bg-charbon-600 hover:text-white";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={tNav("profile")}
        className="font-display flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-charbon-500 bg-linear-to-br from-carmin to-rouge-fonce text-[15px] tracking-[1px] text-white transition hover:scale-105 hover:border-carmin"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-[200px] overflow-hidden rounded-xl border border-charbon-500 bg-charbon-800 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {displayName && (
            <div className="border-b border-charbon-600 px-3.5 py-2.5">
              <div className="truncate text-[11px] font-extrabold tracking-wide text-texte-faible uppercase">{tNav("profile")}</div>
              <div className="mt-0.5 truncate text-[12.5px] font-bold text-blanc-casse">{displayName}</div>
            </div>
          )}
          <Link href="/profil" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tNav("profile")}
          </Link>
          <Link href="/collection" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tNav("collection")}
          </Link>
          <Link href="/notifications" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tNav("notifications")}
          </Link>
          <Link href="/messages" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tNav("messages")}
          </Link>
          <Link href="/portefeuille" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tNav("wallet")}
          </Link>
          <Link href="/wishlist" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tFooter("linkWishlist")}
          </Link>
          <div className="my-1 border-t border-charbon-600" />
          {staffDashboardHref && (
            <Link
              href={staffDashboardHref}
              role="menuitem"
              className={`${itemClass} text-or hover:bg-or/10 hover:text-or-clair`}
              onClick={() => setOpen(false)}
            >
              {tNav("staffConsole")}
            </Link>
          )}
          <Link href="/parametres" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tProfile("linkSettings")}
          </Link>
          <div className="my-1 border-t border-charbon-600" />
          <LogoutLink label={tAuth("logout")} variant="menu" className="uppercase tracking-wide" />
        </div>
      )}
    </div>
  );
}
