#!/usr/bin/env tsx
/**
 * Crée 5 comptes staff de démo (1 rôle chacun) dans Auth0 + Prisma.
 * Usage : pnpm staff:seed
 * Mot de passe : STAFF_DEMO_PASSWORD dans .env, ou "ThePark2026!" par défaut (dev uniquement).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AdminRole } from "../src/generated/prisma/client";
import { auth0Management, isAuth0ManagementConfigured } from "../src/lib/auth0-management";
import {
  AUTH0_ROLE_DEFINITIONS,
  MODULES_BY_STAFF_ROLE,
  staffRoleToAuth0Name,
} from "../src/server/auth/roles.definition";

const DEMO_PASSWORD = process.env.STAFF_DEMO_PASSWORD ?? "ThePark2026!";

const STAFF_ACCOUNTS: {
  email: string;
  displayName: string;
  slug: string;
  staffRole: AdminRole;
}[] = [
  { email: "owner@thepark.local", displayName: "The Park Owner", slug: "the-park-owner", staffRole: "OWNER" },
  { email: "moderator@thepark.local", displayName: "Modérateur Démo", slug: "moderateur-demo", staffRole: "MODERATOR" },
  { email: "catalog@thepark.local", displayName: "Catalogue Démo", slug: "catalogue-demo", staffRole: "CATALOG_MANAGER" },
  { email: "shop@thepark.local", displayName: "Boutique Démo", slug: "boutique-demo", staffRole: "SHOP_MANAGER" },
  { email: "support@thepark.local", displayName: "Support Démo", slug: "support-demo", staffRole: "SUPPORT" },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mgmtWithRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("429") || attempt === retries) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error("mgmtWithRetry: unreachable");
}

async function ensureAuth0RolesExist() {
  const existingRoles = await auth0Management.listRoles();
  const existingNames = new Set(existingRoles.map((r) => r.name));
  for (const def of AUTH0_ROLE_DEFINITIONS) {
    if (!existingNames.has(def.name)) {
      await auth0Management.createRole({ name: def.name, description: def.description });
    }
  }
}

async function findOrCreateAuth0User(account: (typeof STAFF_ACCOUNTS)[number]) {
  const existing = await auth0Management.getUsersByEmail(account.email);
  if (existing.length > 0) {
    return existing[0];
  }
  const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === account.staffRole)!;
  return auth0Management.createUser({
    email: account.email,
    password: DEMO_PASSWORD,
    name: account.displayName,
    app_metadata: {
      staff_role: def.staffRole,
      staff_modules: MODULES_BY_STAFF_ROLE[def.staffRole],
    },
  });
}

async function assignParkRole(auth0Id: string, staffRole: AdminRole, allRoles: { id: string; name: string }[]) {
  const parkRoleIds = allRoles
    .filter((r) => AUTH0_ROLE_DEFINITIONS.some((d) => d.name === r.name))
    .map((r) => r.id);

  if (parkRoleIds.length > 0) {
    await mgmtWithRetry(() => auth0Management.removeUserRoles(auth0Id, parkRoleIds));
    await sleep(400);
  }

  const roleName = staffRoleToAuth0Name(staffRole);
  const role = allRoles.find((r) => r.name === roleName);
  if (!role) throw new Error(`Rôle Auth0 introuvable : ${roleName}`);

  await mgmtWithRetry(() => auth0Management.assignRoles(auth0Id, [role.id]));
  await sleep(400);
  await mgmtWithRetry(() =>
    auth0Management.updateAppMetadata(auth0Id, {
      staff_role: staffRole,
      staff_modules: MODULES_BY_STAFF_ROLE[staffRole],
    }),
  );
}

async function upsertPrismaUser(
  account: (typeof STAFF_ACCOUNTS)[number],
  auth0Id: string,
) {
  const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === account.staffRole)!;
  return prisma.user.upsert({
    where: { email: account.email },
    update: {
      auth0Id,
      displayName: account.displayName,
      slug: account.slug,
      role: def.userRole,
      staffRole: def.staffRole,
      status: "ACTIVE",
    },
    create: {
      auth0Id,
      email: account.email,
      displayName: account.displayName,
      slug: account.slug,
      role: def.userRole,
      staffRole: def.staffRole,
      status: "ACTIVE",
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquant");
  }
  if (!isAuth0ManagementConfigured()) {
    throw new Error("AUTH0_M2M_* manquant — impossible de créer les comptes Auth0");
  }

  await ensureAuth0RolesExist();
  const allRoles = await auth0Management.listRoles();

  console.log("→ Création / mise à jour des comptes staff (Auth0 + Prisma)\n");

  for (const account of STAFF_ACCOUNTS) {
    const auth0User = await findOrCreateAuth0User(account);
    if (!auth0User.user_id) throw new Error(`Auth0 user_id manquant pour ${account.email}`);

    await assignParkRole(auth0User.user_id, account.staffRole, allRoles);
    await upsertPrismaUser(account, auth0User.user_id);
    await sleep(600);

    const roleName = staffRoleToAuth0Name(account.staffRole);
    console.log(`  ✓ ${account.displayName}`);
    console.log(`      email    : ${account.email}`);
    console.log(`      rôle     : ${account.staffRole} (${roleName})`);
    console.log(`      auth0Id  : ${auth0User.user_id}\n`);
  }

  console.log("── Connexion ──");
  console.log(`  Mot de passe (tous) : ${DEMO_PASSWORD}`);
  console.log("  URL : http://localhost:3000/auth/login");
  console.log("\n  Comptes :");
  for (const a of STAFF_ACCOUNTS) {
    console.log(`    · ${a.email} → ${a.staffRole}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
