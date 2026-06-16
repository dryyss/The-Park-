import type { AdminRole, UserRole } from "@/generated/prisma/client";

/** Modules admin — masqués côté UI et vérifiés côté serveur. */
export type AdminModule = "overview" | "moderation" | "catalog" | "shop" | "support" | "staff";

/** Entrée de navigation console admin (liée à un module RBAC). */
export interface AdminDashboard {
  module: AdminModule;
  href: string;
  labelKey: "overview" | "moderation" | "catalog" | "shop" | "orders" | "settings" | "support" | "staff";
}

/** Dashboards disponibles — filtrés par MODULES_BY_STAFF_ROLE côté serveur. */
export const ADMIN_DASHBOARDS: AdminDashboard[] = [
  { module: "overview", href: "/admin", labelKey: "overview" },
  { module: "moderation", href: "/admin/moderation", labelKey: "moderation" },
  { module: "catalog", href: "/admin/catalogue", labelKey: "catalog" },
  { module: "shop", href: "/admin/boutique", labelKey: "shop" },
  { module: "shop", href: "/admin/commandes", labelKey: "orders" },
  { module: "shop", href: "/admin/reglages", labelKey: "settings" },
  { module: "support", href: "/admin/support", labelKey: "support" },
  { module: "staff", href: "/admin/roles", labelKey: "staff" },
];

/** Dashboard par défaut après connexion staff (Post-Login Action). */
export const DEFAULT_DASHBOARD_BY_STAFF_ROLE: Record<AdminRole, string> = {
  OWNER: "/admin",
  MODERATOR: "/admin/moderation",
  CATALOG_MANAGER: "/admin/catalogue",
  SHOP_MANAGER: "/admin/boutique",
  SUPPORT: "/admin/support",
};

export function getDashboardsForStaffRole(staffRole: AdminRole): AdminDashboard[] {
  const modules = MODULES_BY_STAFF_ROLE[staffRole];
  return ADMIN_DASHBOARDS.filter((d) => modules.includes(d.module));
}

export function getDefaultDashboardForStaffRole(staffRole: AdminRole | null): string {
  if (!staffRole) return "/admin";
  return DEFAULT_DASHBOARD_BY_STAFF_ROLE[staffRole];
}

/** Rôles Auth0 (RBAC) — préfixe `park_` pour éviter les collisions. */
export const AUTH0_ROLE_DEFINITIONS = [
  {
    name: "park_owner",
    description: "The Park — Owner (accès total, gestion du staff)",
    staffRole: "OWNER" as AdminRole,
    userRole: "ADMIN" as UserRole,
  },
  {
    name: "park_moderator",
    description: "The Park — Modérateur (signalements, litiges, mineurs prioritaires)",
    staffRole: "MODERATOR" as AdminRole,
    userRole: "MODERATOR" as UserRole,
  },
  {
    name: "park_catalog_manager",
    description: "The Park — Gestionnaire catalogue (cartes, saisons, versions)",
    staffRole: "CATALOG_MANAGER" as AdminRole,
    userRole: "ADMIN" as UserRole,
  },
  {
    name: "park_shop_manager",
    description: "The Park — Gestionnaire boutique officielle (produits, commandes)",
    staffRole: "SHOP_MANAGER" as AdminRole,
    userRole: "ADMIN" as UserRole,
  },
  {
    name: "park_support",
    description: "The Park — Support (aide, tickets membres)",
    staffRole: "SUPPORT" as AdminRole,
    userRole: "ADMIN" as UserRole,
  },
] as const;

export type Auth0RoleName = (typeof AUTH0_ROLE_DEFINITIONS)[number]["name"];

/** Priorité décroissante si plusieurs rôles Auth0 sont assignés. */
export const STAFF_ROLE_PRIORITY: AdminRole[] = [
  "OWNER",
  "MODERATOR",
  "CATALOG_MANAGER",
  "SHOP_MANAGER",
  "SUPPORT",
];

const AUTH0_NAME_TO_DEF = new Map(AUTH0_ROLE_DEFINITIONS.map((d) => [d.name, d]));

export function mapAuth0RoleNames(roleNames: string[]): {
  staffRole: AdminRole | null;
  userRole: UserRole;
} {
  const matched = roleNames
    .map((n) => AUTH0_NAME_TO_DEF.get(n as Auth0RoleName))
    .filter((d): d is (typeof AUTH0_ROLE_DEFINITIONS)[number] => Boolean(d));

  if (matched.length === 0) {
    return { staffRole: null, userRole: "MEMBER" };
  }

  const staffRole =
    STAFF_ROLE_PRIORITY.find((p) => matched.some((m) => m.staffRole === p)) ?? matched[0].staffRole;
  const def = matched.find((m) => m.staffRole === staffRole)!;

  return { staffRole, userRole: def.userRole };
}

export function staffRoleToAuth0Name(staffRole: AdminRole): Auth0RoleName {
  const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === staffRole);
  if (!def) throw new Error(`UNKNOWN_STAFF_ROLE:${staffRole}`);
  return def.name;
}

/** Matrice des permissions par sous-rôle (CDC §6). */
export const MODULES_BY_STAFF_ROLE: Record<AdminRole, AdminModule[]> = {
  OWNER: ["overview", "moderation", "catalog", "shop", "support", "staff"],
  MODERATOR: ["overview", "moderation", "support"],
  CATALOG_MANAGER: ["overview", "catalog"],
  SHOP_MANAGER: ["overview", "shop"],
  SUPPORT: ["overview", "support"],
};
