"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

function FooterLink({ href, children, gold, live }: { href: string; children: React.ReactNode; gold?: boolean; live?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex w-fit items-center gap-2 text-[13px] font-bold transition hover:translate-x-[3px]",
        gold ? "text-or hover:text-or-clair font-extrabold" : "text-[#a9a9b2] hover:text-carmin",
      ].join(" ")}
    >
      {children}
      {live && (
        <span className="rounded bg-carmin/15 px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-[0.5px] text-carmin-neon">
          LIVE
        </span>
      )}
    </Link>
  );
}

function ColTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5 text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{children}</div>;
}

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-16 border-t border-charbon-600">
      <div className="mx-auto max-w-[1320px] px-7">
        <div className="grid grid-cols-1 gap-9 py-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Marque + newsletter */}
          <div>
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 -rotate-[4deg] overflow-hidden rounded-[10px] bg-blanc-casse shadow-lg">
                <Image src="/uploads/pasted-1781200672492-0.png" alt="The Park" width={44} height={44} className="h-full w-full scale-110 object-cover" />
              </span>
              <span className="leading-none">
                <span className="font-display block text-[20px] tracking-[1.5px] text-blanc-casse">THE PARK</span>
                <span className="font-jp mt-[3px] block text-[9px] font-bold tracking-[3px] text-carmin">駐車場 · DRIFT/JDM</span>
              </span>
            </div>
            <p className="mt-4 max-w-[300px] text-[13px] leading-relaxed text-texte-muet">{t("tagline")}</p>

            <div className="mt-[18px]">
              <div className="mb-2 text-[10px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("newsletterTitle")}</div>
              <form className="flex max-w-[300px] gap-2">
                <input
                  type="email"
                  placeholder={t("newsletterPlaceholder")}
                  className="min-w-0 flex-1 rounded-[9px] border-[1.5px] border-charbon-500 bg-charbon-800 px-3.5 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
                />
                <button
                  type="submit"
                  className="font-display -skew-x-3 rounded-[9px] bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white transition hover:bg-carmin-alt"
                >
                  {t("newsletterCta")}
                </button>
              </form>
            </div>
          </div>

          {/* Explorer */}
          <div>
            <ColTitle>{t("colExplore")}</ColTitle>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="/">{t("linkHome")}</FooterLink>
              <FooterLink href="/collection">{t("linkCollection")}</FooterLink>
              <FooterLink href="/saison-1">{t("linkSeason1")}</FooterLink>
              <FooterLink href="/marketplace">{t("linkMarketplace")}</FooterLink>
              <FooterLink href="/encheres" live>{t("linkAuctions")}</FooterLink>
              <FooterLink href="/recherche">{t("linkSearch")}</FooterLink>
            </div>
          </div>

          {/* Communauté */}
          <div>
            <ColTitle>{t("colCommunity")}</ColTitle>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="/echanges">{t("linkExchanges")}</FooterLink>
              <FooterLink href="/classements">{t("linkRankings")}</FooterLink>
              <FooterLink href="/trophees">{t("linkTrophies")}</FooterLink>
              <FooterLink href="/drop" live>{t("linkDrop")}</FooterLink>
              <FooterLink href="/saison-2">{t("linkSeason2")}</FooterLink>
            </div>
          </div>

          {/* Mon compte */}
          <div>
            <ColTitle>{t("colAccount")}</ColTitle>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="/profil">{t("linkProfile")}</FooterLink>
              <FooterLink href="/dashboard">{t("linkSellerDashboard")}</FooterLink>
              <FooterLink href="/wishlist">{t("linkWishlist")}</FooterLink>
              <FooterLink href="/notifications">{t("linkNotifications")}</FooterLink>
              <FooterLink href="/parametres">{t("linkSettings")}</FooterLink>
              <FooterLink href="/admin" gold>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {t("linkAdmin")}
              </FooterLink>
            </div>
          </div>
        </div>

        {/* Barre légale */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-charbon-600 py-[18px] pb-[30px]">
          <div className="flex flex-wrap items-center gap-[18px]">
            <span className="text-[12px] font-bold text-texte-faible">{t("rights")}</span>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("terms")}</Link>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("privacy")}</Link>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("shipping")}</Link>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("help")}</Link>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-[7px] text-[12px] font-bold text-texte-faible">
              <span className="h-1.5 w-1.5 rounded-full bg-statut-succes" />
              {t("status")}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold text-texte-faible">{t("developedBy")}</span>
              <Image
                src="/magar-developpement-logo.svg"
                alt={t("developedByAlt")}
                width={88}
                height={24}
                className="h-6 w-auto opacity-80 transition hover:opacity-100"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
