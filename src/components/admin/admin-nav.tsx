"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { AdminDashboard } from "@/server/auth/roles.definition";
import type { AdminRole } from "@/generated/prisma/client";

export function AdminNav({
  dashboards,
  staffRole,
  variant = "horizontal",
}: {
  dashboards: AdminDashboard[];
  staffRole: AdminRole;
  variant?: "horizontal" | "sidebar";
}) {
  const t = useTranslations("admin.nav");
  const tRoles = useTranslations("admin.roles.staffRoles");
  const pathname = usePathname();

  if (dashboards.length === 0) return null;

  const isSidebar = variant === "sidebar";

  return (
    <nav
      aria-label={t("ariaLabel")}
      className={
        isSidebar
          ? "flex flex-col gap-1"
          : "mb-8 flex flex-wrap items-center gap-2 border-b border-charbon-500 pb-4"
      }
    >
      {!isSidebar && (
        <span className="mr-2 text-[10px] font-extrabold tracking-[2px] text-or uppercase">
          {tRoles(staffRole)}
        </span>
      )}
      {dashboards.map((d) => {
        const active = d.href === "/admin" ? pathname === "/admin" : pathname.startsWith(d.href);
        return (
          <Link
            key={d.href}
            href={d.href}
            className={[
              "font-display tracking-[1px] uppercase transition",
              isSidebar
                ? [
                    "rounded-lg px-3 py-2.5 text-[12px]",
                    active
                      ? "bg-carmin text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                      : "text-texte-muet hover:bg-charbon-700 hover:text-blanc-casse",
                  ].join(" ")
                : [
                    "rounded-[8px] px-3 py-2 text-[11px]",
                    active
                      ? "bg-carmin text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                      : "border border-charbon-500 text-texte-muet hover:border-carmin hover:text-blanc-casse",
                  ].join(" "),
            ].join(" ")}
          >
            {t(d.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
