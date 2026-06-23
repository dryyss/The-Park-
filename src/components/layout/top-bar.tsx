"use client";

// La route /auth/login est servie par le middleware Auth0, pas par une page Next.
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useUser } from "@auth0/nextjs-auth0";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { formatWalletEur } from "@/lib/wallet";

type NavItem = { href: string; key: "home" | "collection" | "marketplace" | "shop" | "exchanges" | "rankings" | "profile"; official?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "home" },
  { href: "/collection", key: "collection" },
  { href: "/marketplace", key: "marketplace" },
  { href: "/boutique", key: "shop", official: true },
  { href: "/echanges", key: "exchanges" },
  { href: "/classements", key: "rankings" },
  { href: "/profil", key: "profile" },
];

function IconButton({ href, title, children, badge }: { href: string; title: string; children: React.ReactNode; badge?: "dot" | string }) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className="relative flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[9px] border border-charbon-500 bg-charbon-800 text-texte-doux transition hover:-translate-y-0.5 hover:border-carmin hover:text-white"
    >
      {children}
      {badge === "dot" && (
        <span className="absolute -top-[3px] -right-[3px] h-[9px] w-[9px] rounded-full border-2 border-charbon bg-carmin" />
      )}
      {badge && badge !== "dot" && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-lg border-2 border-charbon bg-carmin px-1 text-[9.5px] font-extrabold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function TopBar() {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const [live, setLive] = useState({
    cart: 0,
    marketplaceCart: 0,
    notifications: 0,
    messages: 0,
    staffDashboardHref: null as string | null,
    walletBalanceEur: null as number | null,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/topbar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) {
          setLive({
            cart: Number(data.cart) || 0,
            marketplaceCart: Number(data.marketplaceCart) || 0,
            notifications: Number(data.notifications) || 0,
            messages: Number(data.messages) || 0,
            staffDashboardHref: typeof data.staffDashboardHref === "string" ? data.staffDashboardHref : null,
            walletBalanceEur: typeof data.walletBalanceEur === "number" ? data.walletBalanceEur : null,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  const totalCartCount = live.cart + live.marketplaceCart;
  const cartBadge = totalCartCount > 0 ? (totalCartCount > 99 ? "99+" : String(totalCartCount)) : undefined;

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-charbon-500 bg-charbon/[0.86] px-4 backdrop-blur-md sm:h-[66px] sm:gap-5 md:gap-7 md:px-6 lg:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <span className="h-9 w-9 -rotate-[4deg] overflow-hidden rounded-[9px] bg-blanc-casse shadow-lg sm:h-[42px] sm:w-[42px]">
            <Image src="/uploads/pasted-1781200672492-0.png" alt="The Park" width={42} height={42} className="h-full w-full scale-110 object-cover" />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-[17px] tracking-[1.5px] text-blanc-casse sm:text-[19px]">THE PARK</span>
            <span className="font-jp mt-[3px] text-[9px] font-bold tracking-[3px] text-carmin sm:text-[9.5px]">駐車場 · DRIFT/JDM</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={true}
                className={[
                  "font-display rounded-[7px] px-3 py-2 text-[12.5px] tracking-[1.4px] transition",
                  active
                    ? "-rotate-[1.5deg] bg-carmin text-white shadow-[3px_3px_0_rgba(0,0,0,0.45)]"
                    : item.official
                      ? "text-or hover:-translate-y-0.5 hover:bg-charbon-700 hover:text-or-clair"
                      : "text-texte-muet hover:-translate-y-0.5 hover:bg-charbon-700 hover:text-blanc-casse",
                ].join(" ")}
              >
                {t(item.key).toUpperCase()}
                {item.official && <span className="ml-1 text-[9px]">✔</span>}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 md:ml-0 md:gap-2.5">
          <IconButton href="/recherche" title={t("search")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </IconButton>

          <Link
            href="/portefeuille"
            title={t("wallet")}
            aria-label={
              user && live.walletBalanceEur !== null ? `${t("wallet")} — ${formatWalletEur(live.walletBalanceEur)} €` : t("wallet")
            }
            className="relative hidden h-[35px] shrink-0 items-center gap-1.5 rounded-[9px] border border-charbon-500 bg-charbon-800 px-2 text-texte-doux transition hover:-translate-y-0.5 hover:border-carmin hover:text-white sm:flex sm:px-2.5"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            {user && live.walletBalanceEur !== null && (
              <span className="font-display text-[11px] tracking-[0.5px] text-carmin tabular-nums">
                {formatWalletEur(live.walletBalanceEur)} €
              </span>
            )}
          </Link>

          <span className="hidden sm:contents">
            <IconButton href="/notifications" title={t("notifications")} badge={live.notifications > 0 ? "dot" : undefined}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </IconButton>
            <IconButton href="/messages" title={t("messages")} badge={live.messages > 0 ? "dot" : undefined}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </IconButton>
          </span>

          <IconButton href="/panier" title={t("cart")} badge={cartBadge}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
          </IconButton>

          <span className="hidden md:contents">
            <LanguageSwitcher />
          </span>

          {user && (
            <Link
              href="/vendre"
              className="font-display hidden -skew-x-3 items-center gap-1 rounded-[10px] bg-carmin px-3 py-2 text-[12px] tracking-[1px] text-white shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt lg:flex"
            >
              <span className="text-base leading-none">+</span>
              {t("sell").toUpperCase()}
            </Link>
          )}

          {user ? (
            <UserMenu staffDashboardHref={live.staffDashboardHref} />
          ) : (
            <a
              href="/auth/login"
              className="font-display hidden h-[38px] items-center rounded-full border border-charbon-500 bg-charbon-800 px-4 text-[12px] tracking-[1px] text-blanc-casse uppercase transition hover:border-carmin sm:flex"
            >
              {tAuth("login")}
            </a>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[9px] border border-charbon-500 bg-charbon-800 text-texte-doux transition hover:border-carmin hover:text-white md:hidden"
            aria-label={t("menu")}
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
      </header>

      <MobileNavDrawer
        open={menuOpen}
        onClose={closeMenu}
        live={{
          notifications: live.notifications,
          messages: live.messages,
          walletBalanceEur: live.walletBalanceEur,
          staffDashboardHref: live.staffDashboardHref,
        }}
      />
    </>
  );
}
