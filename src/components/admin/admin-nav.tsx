"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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
  const router = useRouter();
  // Les pages admin sont dynamiques et lentes : sans retour visuel immédiat on
  // croit que le clic n'a pas été pris en compte et on reclique. On surligne
  // donc la cible dès le clic, le temps de la navigation.
  const [pending, startTransition] = useTransition();
  const [targetHref, setTargetHref] = useState<string | null>(null);

  function go(e: React.MouseEvent, href: string) {
    // Laisse le navigateur gérer clic milieu / ctrl / cmd / maj (nouvel onglet).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setTargetHref(href);
    startTransition(() => router.push(href));
  }

  if (dashboards.length === 0) return null;

  const isSidebar = variant === "sidebar";
  // Pendant la navigation la cible fait autorité, sinon c'est l'URL courante.
  const basePath = pending && targetHref ? targetHref : pathname;

  return (
    <nav
      aria-label={t("ariaLabel")}
      aria-busy={pending}
      className={[
        isSidebar
          ? "flex flex-col gap-1"
          : "mb-8 flex flex-wrap items-center gap-2 border-b border-charbon-500 pb-4",
        pending ? "opacity-80" : "",
      ].join(" ")}
    >
      {!isSidebar && (
        <span className="mr-2 text-[10px] font-extrabold tracking-[2px] text-or uppercase">
          {tRoles(staffRole)}
        </span>
      )}
      {dashboards.map((d) => {
        const active = d.href === "/admin" ? basePath === "/admin" : basePath.startsWith(d.href);
        return (
          <Link
            key={d.href}
            href={d.href}
            onClick={(e) => go(e, d.href)}
            aria-current={active ? "page" : undefined}
            className={[
              "font-display tracking-[1px] uppercase transition",
              isSidebar
                ? [
                    "rounded-lg px-3 py-2.5 text-[12px]",
                    active
                      ? "bg-carmin text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                      : "text-admin-label hover:bg-admin-panel hover:text-blanc-casse",
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
