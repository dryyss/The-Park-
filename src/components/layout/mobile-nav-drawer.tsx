"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useUser } from "@auth0/nextjs-auth0";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { LogoutLink } from "@/components/auth/logout-link";
import { formatWalletEur } from "@/lib/wallet";
import { FEATURES } from "@/lib/features";

type NavItem = {
  href: string;
  key: "home" | "collection" | "marketplace" | "shop" | "exchanges" | "auctions" | "rivals" | "rankings" | "profile";
  official?: boolean;
};

const NAV_ITEMS: NavItem[] = ([
  { href: "/", key: "home" },
  { href: "/collection", key: "collection" },
  { href: "/marketplace", key: "marketplace" },
  { href: "/encheres", key: "auctions" },
  { href: "/boutique", key: "shop", official: true },
  { href: "/echanges", key: "exchanges" },
  { href: "/rivaux", key: "rivals" },
  { href: "/classements", key: "rankings" },
  { href: "/profil", key: "profile" },
] satisfies NavItem[]).filter((i) => FEATURES.exchange || i.key !== "exchanges");

const EXTRA_LINKS = [
  { href: "/drop", key: "drop" as const },
  { href: "/notifications", key: "notifications" as const },
  { href: "/messages", key: "messages" as const },
  { href: "/portefeuille", key: "wallet" as const },
  { href: "/wishlist", key: "wishlist" as const },
  { href: "/parametres", key: "settings" as const },
  { href: "/aide", key: "help" as const },
] as const;

export function MobileNavDrawer({
  open,
  onClose,
  live,
}: {
  open: boolean;
  onClose: () => void;
  live: {
    notifications: number;
    messages: number;
    walletBalanceEur: number | null;
    staffDashboardHref: string | null;
  };
}) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tFooter = useTranslations("footer");
  const pathname = usePathname();
  const { user } = useUser();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Ferme le tiroir quand la route change (clic sur un lien).
  // Ne PAS dépendre de `open` : sinon l'effet se rejoue à l'ouverture et referme aussitôt.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t("menu")}>
      <button
        type="button"
        className="absolute inset-0 bg-charbon/70 backdrop-blur-sm"
        aria-label={t("closeMenu")}
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-[min(100vw-3rem,320px)] flex-col border-l border-charbon-500 bg-charbon-900 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-charbon-600 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 -rotate-[4deg] overflow-hidden rounded-[8px] bg-blanc-casse">
              <Image src="/uploads/pasted-1781200672492-0.png" alt="The Park" width={36} height={36} className="h-full w-full scale-110 object-cover" />
            </span>
            <span className="font-display text-[15px] tracking-[1px] text-blanc-casse">THE PARK</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-charbon-500 text-texte-doux transition hover:border-carmin hover:text-white"
            aria-label={t("closeMenu")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={[
                    "font-display rounded-lg px-3.5 py-3 text-[13px] tracking-[1.2px] transition",
                    active
                      ? "bg-carmin text-white"
                      : item.official
                        ? "text-or hover:bg-charbon-800"
                        : "text-texte-doux hover:bg-charbon-800 hover:text-blanc-casse",
                  ].join(" ")}
                >
                  {t(item.key).toUpperCase()}
                  {item.official && <span className="ml-1 text-[9px]">✔</span>}
                </Link>
              );
            })}
          </div>

          <div className="mb-4 border-t border-charbon-600 pt-4">
            <div className="mb-2 px-1 text-[10px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("more")}</div>
            <div className="flex flex-col gap-0.5">
              {EXTRA_LINKS.map((link) => {
                const active = pathname.startsWith(link.href);
                const badge =
                  link.key === "notifications" && live.notifications > 0
                    ? live.notifications
                    : link.key === "messages" && live.messages > 0
                      ? live.messages
                      : null;
                const label =
                  link.key === "wishlist"
                    ? tFooter("linkWishlist")
                    : link.key === "settings"
                      ? tFooter("linkSettings")
                      : link.key === "help"
                        ? tFooter("help")
                        : t(link.key);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-bold transition",
                      active ? "bg-charbon-700 text-blanc-casse" : "text-texte-muet hover:bg-charbon-800 hover:text-blanc-casse",
                    ].join(" ")}
                  >
                    <span>{label}</span>
                    {badge !== null && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-carmin px-1.5 text-[10px] font-extrabold text-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                    {link.key === "wallet" && user && live.walletBalanceEur !== null && (
                      <span className="font-display text-[11px] text-carmin tabular-nums">{formatWalletEur(live.walletBalanceEur)} €</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {user && live.staffDashboardHref && (
            <Link
              href={live.staffDashboardHref}
              className="mb-4 flex items-center gap-2 rounded-lg border border-or/30 bg-or/10 px-3.5 py-3 text-[12px] font-extrabold text-or"
            >
              {t("staffConsole")} →
            </Link>
          )}

          {user && (
            <Link
              href="/vendre"
              className="font-display mb-4 flex items-center justify-center gap-1.5 rounded-lg bg-carmin px-4 py-3 text-[12px] tracking-[1px] text-white"
            >
              <span className="text-base leading-none">+</span>
              {t("sell").toUpperCase()}
            </Link>
          )}
        </nav>

        <div className="space-y-3 border-t border-charbon-600 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-texte-dim">{t("language")}</span>
            <LanguageSwitcher />
          </div>
          {user ? (
            <LogoutLink label={tAuth("logout")} variant="menu" className="w-full rounded-lg uppercase tracking-wide" />
          ) : (
            <a
              href="/auth/login"
              className="font-display flex w-full items-center justify-center rounded-lg border border-charbon-500 bg-charbon-800 py-3 text-[12px] tracking-[1px] text-blanc-casse uppercase"
            >
              {tAuth("login")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
