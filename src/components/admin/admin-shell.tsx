"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminDashboard } from "@/server/auth/roles.definition";
import type { AdminRole } from "@/generated/prisma/client";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminTopbar } from "@/components/admin/admin-topbar";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <div className="admin-theme flex min-h-screen bg-admin-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-charbon/60 backdrop-blur-sm lg:hidden"
          aria-label={t("closeMenu")}
          onClick={closeSidebar}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[min(100vw-3rem,248px)] shrink-0 flex-col border-r border-admin-border bg-admin-panel transition-transform duration-200 lg:sticky lg:z-auto lg:w-[248px] lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="sticky top-0 z-[2] border-b border-admin-border bg-admin-panel px-[18px] py-[18px]">
          <div className="flex items-center gap-2.5">
            <span className="h-[38px] w-[38px] shrink-0 -rotate-[4deg] overflow-hidden rounded-[9px] bg-blanc-casse">
              <Image src="/uploads/pasted-1781200672492-0.png" alt="The Park" width={38} height={38} className="h-full w-full scale-110 object-cover" />
            </span>
            <div className="min-w-0 flex-1 leading-none">
              <div className="font-display truncate text-[15px] tracking-[1px] text-blanc-casse">THE PARK</div>
              <div className="mt-1 text-[8.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("consoleTitle")}</div>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-admin-border text-texte-dim transition hover:text-blanc-casse lg:hidden"
              aria-label={t("closeMenu")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3" onClick={closeSidebar}>
          <AdminNav dashboards={dashboards} staffRole={staffRole} variant="sidebar" />
        </div>

        <div className="space-y-1 border-t border-admin-border px-3 py-3">
          <Link
            href="/"
            className="flex w-full items-center gap-2.5 rounded-[10px] bg-[#1c1c21] px-3 py-2.5 text-[12px] font-bold text-admin-label transition hover:text-or"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            {t("backToSite")}
          </Link>
          <LogoutLink label={tAuth("logout")} variant="menu" className="rounded-lg uppercase tracking-wide" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar staffRole={staffRole} displayName={displayName} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden px-4 py-5 pb-14 sm:px-6 sm:py-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
