"use client";

import { useTranslations } from "next-intl";
import type { AdminRole } from "@/generated/prisma/client";

export function AdminTopbar({
  staffRole,
  displayName,
}: {
  staffRole: AdminRole;
  displayName: string;
}) {
  const t = useTranslations("admin.shell");
  const tRoles = useTranslations("admin.roles.staffRoles");

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center gap-4 border-b border-admin-border bg-admin-panel/95 px-6 py-3 backdrop-blur-sm">
      <div className="flex max-w-[38vw] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-admin-border bg-[#1c1c21] px-3 py-2 sm:max-w-[320px]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5a5a64" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-blanc-casse outline-none placeholder:text-texte-faible"
          aria-label={t("searchPlaceholder")}
        />
        <span className="hidden rounded border border-charbon-500 px-1.5 py-0.5 text-[10px] font-bold text-texte-faible sm:inline">
          ⌘K
        </span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        title={t("notifications")}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-admin-border bg-[#1c1c21] text-texte-doux transition hover:border-charbon-400"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full border-2 border-admin-panel bg-statut-danger" />
      </button>

      <div className="flex items-center gap-2.5 rounded-[11px] border border-admin-border bg-[#1c1c21] px-2 py-1.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-carmin text-[13px] text-white">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="text-[9.5px] font-bold text-texte-dim">{t("connectedAs")}</div>
          <div className="truncate text-[12.5px] font-extrabold text-blanc-casse">{tRoles(staffRole)}</div>
        </div>
      </div>
    </header>
  );
}
