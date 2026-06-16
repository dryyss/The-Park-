#!/usr/bin/env tsx
/**
 * Setup Auth0 RBAC The Park : rôles + instructions triggers Post-Login.
 * Usage : pnpm auth0:setup
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { auth0Management, isAuth0ManagementConfigured } from "../src/lib/auth0-management";
import {
  AUTH0_ROLE_DEFINITIONS,
  DEFAULT_DASHBOARD_BY_STAFF_ROLE,
  MODULES_BY_STAFF_ROLE,
} from "../src/server/auth/roles.definition";

async function ensureAuth0RolesExist(): Promise<{ created: string[]; existing: string[] }> {
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

function printTriggerInstructions() {
  const actionPath = join(process.cwd(), "scripts/auth0/post-login-sync-roles.js");
  const actionCode = readFileSync(actionPath, "utf8");

  console.log("\n── Trigger Post-Login (Auth0 Dashboard) ──\n");
  console.log("1. Actions → Library → Build Custom → Post Login");
  console.log('   Nom suggéré : "The Park — Sync rôles & staff"');
  console.log("2. Coller le code depuis : scripts/auth0/post-login-sync-roles.js");
  console.log("3. Aucun secret à configurer dans l'action.");
  console.log("   La sync Prisma se fait côté Next.js (getAuthenticatedViewer + AUTH0_M2M_*).");
  console.log("4. Actions → Flows → Login → glisser l'action après le login");
  console.log("5. APIs → ton API → Settings → activer RBAC + « Add Roles in the Access Token »");
  console.log("   (sinon event.authorization.roles sera vide dans l'action)\n");

  console.log("── Matrice rôles → dashboards ──\n");
  for (const def of AUTH0_ROLE_DEFINITIONS) {
    const modules = MODULES_BY_STAFF_ROLE[def.staffRole];
    const dashboard = DEFAULT_DASHBOARD_BY_STAFF_ROLE[def.staffRole];
    console.log(`  ${def.name}`);
    console.log(`    Rôle staff : ${def.staffRole}`);
    console.log(`    Modules    : ${modules.join(", ")}`);
    console.log(`    Dashboard  : ${dashboard}\n`);
  }

  console.log("── Assigner un rôle ──\n");
  console.log("  Auth0 → User Management → Users → [user] → Roles → Assign");
  console.log("  ou Owner connecté → /admin/roles\n");

  if (isAuth0ManagementConfigured()) {
    console.log("✓ AUTH0_M2M_* configuré (sync rôles côté serveur)");
  } else {
    console.log("✗ AUTH0_M2M_* manquant — la sync Prisma des rôles ne fonctionnera pas");
  }

  console.log(`\nTaille du script action : ${actionCode.length} caractères`);
}

async function main() {
  if (!isAuth0ManagementConfigured()) {
    console.error("Management API non configurée (AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET).");
    process.exit(1);
  }

  const result = await ensureAuth0RolesExist();
  console.log("✅ Rôles Auth0 The Park");
  if (result.created.length) console.log("  Créés :", result.created.join(", "));
  if (result.existing.length) console.log("  Déjà présents :", result.existing.join(", "));

  printTriggerInstructions();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
