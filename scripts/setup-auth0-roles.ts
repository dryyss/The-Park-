#!/usr/bin/env tsx
/**
 * Crée les rôles RBAC The Park dans Auth0 (idempotent).
 * Usage : pnpm auth0:roles
 */
import "dotenv/config";
import { auth0Management, isAuth0ManagementConfigured } from "../src/lib/auth0-management";
import { AUTH0_ROLE_DEFINITIONS } from "../src/server/auth/roles.definition";

async function ensureAuth0RolesExist(): Promise<{ created: string[]; existing: string[] }> {
  if (!isAuth0ManagementConfigured()) {
    throw new Error(
      "Management API non configurée : AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET",
    );
  }

  const existingRoles = await auth0Management.listRoles();
  const existingNames = new Set(existingRoles.map((r) => r.name));

  const created: string[] = [];
  const existing: string[] = [];

  for (const def of AUTH0_ROLE_DEFINITIONS) {
    if (existingNames.has(def.name)) {
      existing.push(def.name);
      continue;
    }
    await auth0Management.createRole({ name: def.name, description: def.description });
    created.push(def.name);
  }

  return { created, existing };
}

async function main() {
  const result = await ensureAuth0RolesExist();
  console.log("✅ Rôles Auth0 The Park");
  if (result.created.length) console.log("  Créés :", result.created.join(", "));
  if (result.existing.length) console.log("  Déjà présents :", result.existing.join(", "));
  console.log("\n→ Assigne un rôle dans Auth0 Dashboard → User Management → Users → Roles");
  console.log("  ou via Admin → /admin/roles après connexion Owner.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
