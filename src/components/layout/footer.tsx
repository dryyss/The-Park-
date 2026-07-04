"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FEATURES } from "@/lib/features";

type NewsletterState = "idle" | "sending" | "sent" | "already" | "error";

function NewsletterForm() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<NewsletterState>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: string };
      if (res.ok && data.ok) {
        setState(data.result === "ALREADY_CONFIRMED" ? "already" : "sent");
        setEmail("");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const message =
    state === "sent"
      ? t("newsletterSuccess")
      : state === "already"
        ? t("newsletterAlready")
        : state === "error"
          ? t("newsletterError")
          : null;

  return (
    <div className="mt-[18px]">
      <div className="mb-2 text-[10px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("newsletterTitle")}</div>
      <form className="flex max-w-[300px] gap-2" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== "idle") setState("idle");
          }}
          placeholder={t("newsletterPlaceholder")}
          className="min-w-0 flex-1 rounded-[9px] border-[1.5px] border-charbon-500 bg-charbon-800 px-3.5 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="font-display -skew-x-3 rounded-[9px] bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white transition hover:bg-carmin-alt disabled:opacity-60"
        >
          {state === "sending" ? t("newsletterSending") : t("newsletterCta")}
        </button>
      </form>
      {message && (
        <p className={`mt-2 text-[11px] font-bold ${state === "error" ? "text-neon-rouge" : "text-statut-succes"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

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
    <footer className="mt-10 border-t border-charbon-600 sm:mt-16">
      <div className="page-container">
        <div className="hidden grid-cols-1 gap-9 py-10 md:grid md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
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

            <NewsletterForm />
          </div>

          {/* Explorer */}
          <div>
            <ColTitle>{t("colExplore")}</ColTitle>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="/">{t("linkHome")}</FooterLink>
              <FooterLink href="/collection">{t("linkCollection")}</FooterLink>
              <FooterLink href="/saison-1">{t("linkSeason1")}</FooterLink>
              <FooterLink href="/hors-serie">{t("linkSeasonHorsSerie")}</FooterLink>
              <FooterLink href="/marketplace">{t("linkMarketplace")}</FooterLink>
              <FooterLink href="/encheres" live>{t("linkAuctions")}</FooterLink>
              <FooterLink href="/recherche">{t("linkSearch")}</FooterLink>
            </div>
          </div>

          {/* Communauté */}
          <div>
            <ColTitle>{t("colCommunity")}</ColTitle>
            <div className="flex flex-col gap-2.5">
              {FEATURES.exchange && <FooterLink href="/echanges">{t("linkExchanges")}</FooterLink>}
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
            </div>
          </div>
        </div>

        {/* Barre légale */}
        <div className="grid grid-cols-1 items-center gap-4 border-t border-charbon-600 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:py-[18px] sm:pb-[30px] md:grid-cols-[1fr_auto_1fr] md:gap-4 md:pb-[30px]">
          <div className="flex flex-wrap items-center justify-center gap-[18px] md:justify-start">
            <span className="text-[12px] font-bold text-texte-faible">{t("rights")}</span>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("terms")}</Link>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("privacy")}</Link>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("shipping")}</Link>
            <Link href="/aide" className="text-[12px] font-bold text-texte-faible transition hover:text-texte-doux">{t("help")}</Link>
          </div>

          <div className="flex flex-col items-center gap-1.5 rounded-lg bg-blanc-casse px-4 py-2.5 shadow-sm ring-1 ring-charbon-500/20">
            <span className="text-[10px] font-extrabold tracking-widest text-charbon-400 uppercase">{t("developedBy")}</span>
            <Image
              src="/magar-developpement-logo.svg"
              alt={t("developedByAlt")}
              width={160}
              height={48}
              className="h-9 w-auto transition hover:scale-105 md:h-10"
            />
          </div>

          <div className="flex items-center justify-center md:justify-end">
            <span className="flex items-center gap-[7px] text-[12px] font-bold text-texte-faible">
              <span className="h-1.5 w-1.5 rounded-full bg-statut-succes" />
              {t("status")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
