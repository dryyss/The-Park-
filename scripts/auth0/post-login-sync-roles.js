/**
 * Auth0 Action — Post-Login
 * Dashboard Auth0 → Actions → Library → Build Custom → Post Login
 *
 * Secrets requis dans l'Action (Settings → Secrets) :
 *   THE_PARK_SYNC_URL    → http://localhost:3000/api/auth/roles/sync  (prod : https://…)
 *   THE_PARK_SYNC_SECRET → même valeur que AUTH0_ACTION_SECRET (.env)
 *
 * Flow Login : glisser l'action après le login, avant le redirect.
 */
exports.onExecutePostLogin = async (event, api) => {
  try {
    const namespace = "https://thepark.app";
    const roles = event.authorization?.roles ?? [];

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

    const matched = priority.find((r) => roles.includes(r));
    const staffRole = matched ? staffRoleMap[matched] : null;

    if (staffRole) {
      api.idToken.setCustomClaim(`${namespace}/staff_role`, staffRole);
      api.accessToken.setCustomClaim(`${namespace}/staff_role`, staffRole);
      try {
        api.user.setAppMetadata("staff_role", staffRole);
      } catch (metaErr) {
        console.log("The Park setAppMetadata skipped:", metaErr);
      }
    }

    const syncUrl = event.secrets.THE_PARK_SYNC_URL;
    const syncSecret = event.secrets.THE_PARK_SYNC_SECRET;

    if (!syncUrl || !syncSecret) {
      console.log("The Park sync skipped: THE_PARK_SYNC_URL or THE_PARK_SYNC_SECRET missing");
      return;
    }

    if (!event.user?.user_id) return;

    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${syncSecret}`,
      },
      body: JSON.stringify({
        auth0Id: event.user.user_id,
        email: event.user.email,
        name: event.user.name,
      }),
    });

    if (!res.ok) {
      console.log("The Park role sync failed:", res.status, await res.text());
    }
  } catch (err) {
    // Ne jamais bloquer la connexion Auth0
    console.log("The Park post-login action error:", err);
  }
};
