"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminDashboard } from "@/server/auth/roles.definition";
import type { AdminRole } from "@/generated/prisma/client";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutLink } from "@/components/auth/logout-link";

export function AdminShell({
  children,
  dashboards,
  staffRole,
  displayName,
}: {
  children: React.ReactNode;
  dashboards: AdminDashboard[];
  staffRole: AdminRole;
  displayName: string;
}) {
  const t = useTranslations("admin.shell");
  const tAuth = useTranslations("auth");
  const tRoles = useTranslations("admin.roles.staffRoles");

  return (
    <div className="admin-theme flex min-h-screen bg-admin-shell">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-admin-border bg-admin-shell">
        <div className="border-b border-admin-border px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-blanc-casse">
              <Image src="/uploads/pasted-1781200672492-0.png" alt="The Park" width={36} height={36} className="h-full w-full scale-110 object-cover" />
            </span>
            <div className="min-w-0 leading-none">
              <div className="font-display truncate text-[13px] tracking-[1px] text-blanc-casse">THE PARK</div>
              <div className="mt-1 text-[9px] font-extrabold tracking-[2px] text-or uppercase">{t("consoleTitle")}</div>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-admin-border bg-admin-panel px-2.5 py-2">
            <div className="truncate text-[11px] font-bold text-blanc-casse">{displayName}</div>
            <div className="mt-0.5 text-[9px] font-extrabold tracking-wide text-or uppercase">{tRoles(staffRole)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AdminNav dashboards={dashboards} staffRole={staffRole} variant="sidebar" />
        </div>

        <div className="space-y-1 border-t border-admin-border px-3 py-4">
          <Link
            href="/"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-bold text-admin-label transition hover:bg-admin-panel hover:text-blanc-casse"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {t("backToSite")}
          </Link>
          <LogoutLink label={tAuth("logout")} variant="menu" className="rounded-lg uppercase tracking-wide" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-admin-border bg-admin-shell/95 px-6 backdrop-blur-sm lg:hidden">
          <span className="font-display text-[13px] tracking-[1px] text-or uppercase">{t("consoleTitle")}</span>
        </header>
        <main className="flex-1 overflow-x-hidden px-6 py-8 pb-12 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
