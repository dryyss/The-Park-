/**
 * Auth0 Action — Post-Login (claims rôles staff dans le token)
 * Dashboard Auth0 → Actions → Library → Build Custom → Post Login
 *
 * Aucun secret requis dans l'action.
 * La synchronisation Prisma (compte + rôles) est faite côté Next.js à la première
 * requête après connexion (getAuthenticatedViewer → Management API Auth0).
 *
 * Prérequis :
 *   - Rôles park_* assignés à l'utilisateur (Auth0 → Users → Roles)
 *   - APIs → Settings → RBAC activé + « Add Roles in the Access Token »
 *   - AUTH0_M2M_* configuré dans .env / Vercel (lecture des rôles côté serveur)
 *
 * Flow Login : glisser l'action après le login, avant le redirect.
 */
exports.onExecutePostLogin = async (event, api) => {
  try {
    const namespace = "https://thepark.app";

    const priority = [
      "park_owner",
      "park_moderator",
      "park_catalog_manager",
      "park_shop_manager",
      "park_support",
    ];
    const staffRoleMap = {
      park_owner: "OWNER",
      park_moderator: "MODERATOR",
      park_catalog_manager: "CATALOG_MANAGER",
      park_shop_manager: "SHOP_MANAGER",
      park_support: "SUPPORT",
    };
    const modulesByStaffRole = {
      OWNER: ["overview", "moderation", "catalog", "shop", "support", "staff"],
      MODERATOR: ["overview", "moderation", "support"],
      CATALOG_MANAGER: ["overview", "catalog"],
      SHOP_MANAGER: ["overview", "shop"],
      SUPPORT: ["overview", "support"],
    };
    const defaultDashboardByStaffRole = {
      OWNER: "/admin",
      MODERATOR: "/admin/moderation",
      CATALOG_MANAGER: "/admin/catalogue",
      SHOP_MANAGER: "/admin/boutique",
      SUPPORT: "/admin/support",
    };

    const roles = event.authorization?.roles ?? [];
    const matched = priority.find((r) => roles.includes(r));
    const staffRole = matched ? staffRoleMap[matched] : null;

    if (!staffRole) return;

    const modules = modulesByStaffRole[staffRole] ?? [];
    const defaultDashboard = defaultDashboardByStaffRole[staffRole] ?? "/admin";

    api.idToken.setCustomClaim(`${namespace}/staff_role`, staffRole);
    api.accessToken.setCustomClaim(`${namespace}/staff_role`, staffRole);
    api.idToken.setCustomClaim(`${namespace}/staff_modules`, modules);
    api.accessToken.setCustomClaim(`${namespace}/staff_modules`, modules);
    api.idToken.setCustomClaim(`${namespace}/default_dashboard`, defaultDashboard);
    api.accessToken.setCustomClaim(`${namespace}/default_dashboard`, defaultDashboard);

    try {
      api.user.setAppMetadata("staff_role", staffRole);
      api.user.setAppMetadata("staff_modules", modules);
      api.user.setAppMetadata("default_dashboard", defaultDashboard);
    } catch (metaErr) {
      console.log("The Park setAppMetadata skipped:", metaErr);
    }
  } catch (err) {
    // Ne jamais bloquer la connexion Auth0
    console.log("The Park post-login action error:", err);
  }
};
