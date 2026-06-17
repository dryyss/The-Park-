// Route Auth0 hors App Router localisé — navigation complète requise.
/* eslint-disable @next/next/no-html-link-for-pages */

type LogoutLinkProps = {
  label: string;
  variant?: "nav" | "profile" | "menu";
  className?: string;
};

const VARIANT_CLASS: Record<NonNullable<LogoutLinkProps["variant"]>, string> = {
  nav: [
    "font-display shrink-0 rounded-[9px] border border-charbon-500 bg-charbon-800",
    "px-2.5 py-2 text-[10px] tracking-[0.5px] text-texte-doux uppercase",
    "transition hover:border-neon-rouge hover:bg-neon-rouge/10 hover:text-neon-rouge",
    "sm:px-3.5 sm:py-2 sm:text-[11px] sm:tracking-[1px]",
  ].join(" "),
  profile: [
    "font-display -skew-x-3 rounded-[10px] border border-neon-rouge/50 bg-neon-rouge/10",
    "px-4 py-2.5 text-[12px] tracking-[1px] text-neon-rouge uppercase",
    "transition hover:border-neon-rouge hover:bg-neon-rouge/20",
  ].join(" "),
  menu: [
    "block w-full px-3.5 py-2.5 text-left text-[12.5px] font-bold text-neon-rouge",
    "transition hover:bg-charbon-600",
  ].join(" "),
};

/** Lien vers /auth/logout (route Auth0, hors i18n). */
export function LogoutLink({ label, variant = "nav", className }: LogoutLinkProps) {
  return (
    <a href="/auth/logout" className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}>
      {label}
    </a>
  );
}
