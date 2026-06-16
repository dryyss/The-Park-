"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { AdminDashboard } from "@/server/auth/roles.definition";
import type { AdminRole } from "@/generated/prisma/client";

export function AdminNav({
  dashboards,
  staffRole,
}: {
  dashboards: AdminDashboard[];
  staffRole: AdminRole;
}) {
  const t = useTranslations("admin.nav");
  const tRoles = useTranslations("admin.roles.staffRoles");
  const pathname = usePathname();

  if (dashboards.length <= 1) return null;

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="mb-8 flex flex-wrap items-center gap-2 border-b border-charbon-500 pb-4"
    >
      <span className="mr-2 text-[10px] font-extrabold tracking-[2px] text-or uppercase">
        {tRoles(staffRole)}
      </span>
      {dashboards.map((d) => {
        const active = d.href === "/admin" ? pathname === "/admin" : pathname.startsWith(d.href);
        return (
          <Link
            key={d.href}
            href={d.href}
            className={[
              "font-display rounded-[8px] px-3 py-2 text-[11px] tracking-[1px] uppercase transition",
              active
                ? "bg-carmin text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                : "border border-charbon-500 text-texte-muet hover:border-carmin hover:text-blanc-casse",
            ].join(" ")}
          >
            {t(d.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
