import "server-only";
import type { AdminRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaffOwnerEmail } from "@/lib/env";
import { auth0Management, isAuth0ManagementConfigured } from "@/lib/auth0-management";
import {
  AUTH0_ROLE_DEFINITIONS,
  MODULES_BY_STAFF_ROLE,
  mapAuth0RoleNames,
  staffRoleToAuth0Name,
} from "@/server/auth/roles.definition";
import { isOwner, resolveStaffRole } from "@/server/auth/permissions.service";

const PARK_AUTH0_ROLE_NAMES = new Set<string>(AUTH0_ROLE_DEFINITIONS.map((d) => d.name));
const STAFF_CLAIM_NAMESPACE = "https://thepark.app";
const MGMT_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const MGMT_SYNC_COOLDOWN_ON_429_MS = 60 * 60 * 1000;

/** Cooldown par instance serverless — limite les appels Management API (quota Auth0). */
const mgmtSyncAfter = new Map<string, number>();

function filterParkAuth0RoleNames(roleNames: string[]): string[] {
  return roleNames.filter((n) => PARK_AUTH0_ROLE_NAMES.has(n));
}

function parseStaffClaim(sessionUser?: Record<string, unknown>): AdminRole | null {
  const claim = sessionUser?.[`${STAFF_CLAIM_NAMESPACE}/staff_role`];
  if (typeof claim !== "string") return null;
  return AUTH0_ROLE_DEFINITIONS.some((d) => d.staffRole === claim) ? (claim as AdminRole) : null;
}

function canCallManagementApi(auth0Id: string): boolean {
  const until = mgmtSyncAfter.get(auth0Id) ?? 0;
  return Date.now() >= until;
}

function deferManagementApi(auth0Id: string, ms: number): void {
  mgmtSyncAfter.set(auth0Id, Date.now() + ms);
}

async function applyStaffRole(auth0Id: string, staffRole: AdminRole): Promise<void> {
  const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === staffRole);
  if (!def) return;

  const existing = await prisma.user.findUnique({
    where: { auth0Id },
    select: { staffRole: true, role: true },
  });
  if (!existing) return;
  if (existing.staffRole === staffRole && existing.role === def.userRole) return;

  await prisma.user.update({
    where: { auth0Id },
    data: { role: def.userRole, staffRole },
  });
}

async function ensureBootstrapOwner(auth0Id: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { auth0Id },
    select: { email: true, staffRole: true, role: true },
  });
  if (!existing?.email || !isStaffOwnerEmail(existing.email)) return false;

  if (existing.staffRole === "OWNER" && existing.role === "ADMIN") return true;

  await prisma.user.update({
    where: { auth0Id },
    data: { role: "ADMIN", staffRole: "OWNER" },
  });
  return true;
}

export interface StaffMemberRow {
  id: string;
  displayName: string;
  email: string;
  slug: string;
  staffRole: AdminRole | null;
  role: import("@/generated/prisma/client").UserRole;
  auth0Id: string | null;
  lastLoginAt: Date | null;
}

/** Synchronise role + staffRole Prisma depuis Auth0 (RBAC + app_metadata + claims token). */
export async function syncRolesFromAuth0(
  auth0Id: string,
  sessionUser?: Record<string, unknown>,
): Promise<void> {
  if (await ensureBootstrapOwner(auth0Id)) return;

  const claimRole = parseStaffClaim(sessionUser);
  if (claimRole) {
    await applyStaffRole(auth0Id, claimRole);
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { auth0Id },
    select: { staffRole: true, role: true, email: true },
  });
  if (!existing) return;

  if (isStaffOwnerEmail(existing.email)) {
    if (existing.staffRole !== "OWNER" || existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { auth0Id },
        data: { role: "ADMIN", staffRole: "OWNER" },
      });
    }
    return;
  }

  // Staff déjà en base : pas d'appel Management API à chaque requête (topbar, navigation…).
  if (existing.staffRole) return;

  if (!isAuth0ManagementConfigured() || !canCallManagementApi(auth0Id)) {
    return;
  }

  let roleNames: string[] = [];
  let metadataRole: AdminRole | null = null;
  let mgmtOk = false;

  try {
    const [roles, user] = await Promise.all([
      auth0Management.getUserRoles(auth0Id),
      auth0Management.getUser(auth0Id),
    ]);
    roleNames = roles.map((r) => r.name);
    mgmtOk = true;
    deferManagementApi(auth0Id, MGMT_SYNC_COOLDOWN_MS);
    const meta = user.app_metadata?.staff_role;
    if (typeof meta === "string") {
      metadataRole = meta as AdminRole;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("429") || msg.includes("too_many_requests")) {
      deferManagementApi(auth0Id, MGMT_SYNC_COOLDOWN_ON_429_MS);
      return;
    }
    console.error("[roles] sync Auth0 Management API", err);
    return;
  }

  const parkRoleNames = filterParkAuth0RoleNames(roleNames);
  const mapped = mapAuth0RoleNames(parkRoleNames);

  const fallbackRole = metadataRole;
  if (!mapped.staffRole && fallbackRole) {
    const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === fallbackRole);
    if (def) {
      mapped.staffRole = fallbackRole;
      mapped.userRole = def.userRole;
    }
  }

  const hasParkAuth0Roles = parkRoleNames.length > 0 || fallbackRole != null;

  if (!mgmtOk && !hasParkAuth0Roles) {
    return;
  }

  if (!hasParkAuth0Roles) {
    return;
  }

  await prisma.user.update({
    where: { auth0Id },
    data: {
      role: mapped.staffRole ? mapped.userRole : existing.role,
      staffRole: mapped.staffRole ?? null,
    },
  });
}

/** Crée les rôles RBAC dans Auth0 (idempotent). */
export async function ensureAuth0RolesExist(): Promise<{ created: string[]; existing: string[] }> {
  if (!isAuth0ManagementConfigured()) {
    throw new Error("AUTH0_M2M_NOT_CONFIGURED");
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

export async function listStaffMembers(): Promise<StaffMemberRow[]> {
  return prisma.user.findMany({
    where: {
      OR: [{ staffRole: { not: null } }, { role: { in: ["ADMIN", "MODERATOR"] } }],
      status: { not: "DELETED" },
    },
    orderBy: [{ staffRole: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      slug: true,
      staffRole: true,
      role: true,
      auth0Id: true,
      lastLoginAt: true,
    },
  });
}

export async function assignStaffRole(
  actorUserId: string,
  targetUserId: string,
  staffRole: AdminRole,
): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true, staffRole: true },
  });
  if (!actor || !isOwner(actor)) {
    throw new Error("FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, auth0Id: true },
  });
  if (!target) throw new Error("USER_NOT_FOUND");

  const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === staffRole);
  if (!def) throw new Error("INVALID_STAFF_ROLE");

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: def.userRole, staffRole: def.staffRole },
  });

  if (target.auth0Id && isAuth0ManagementConfigured()) {
    const allRoles = await auth0Management.listRoles();
    const parkRoleIds = allRoles
      .filter((r) => AUTH0_ROLE_DEFINITIONS.some((d) => d.name === r.name))
      .map((r) => r.id);

    if (parkRoleIds.length > 0) {
      await auth0Management.removeUserRoles(target.auth0Id, parkRoleIds);
    }

    const roleName = staffRoleToAuth0Name(staffRole);
    const auth0Role = allRoles.find((r) => r.name === roleName);
    if (auth0Role) {
      await auth0Management.assignRoles(target.auth0Id, [auth0Role.id]);
    }

    await auth0Management.updateAppMetadata(target.auth0Id, {
      staff_role: staffRole,
      staff_modules: MODULES_BY_STAFF_ROLE[staffRole],
    });
  }
}

export async function revokeStaffAccess(actorUserId: string, targetUserId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true, staffRole: true },
  });
  if (!actor || !isOwner(actor)) throw new Error("FORBIDDEN");
  if (actorUserId === targetUserId) throw new Error("CANNOT_REVOKE_SELF");

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { auth0Id: true },
  });
  if (!target) throw new Error("USER_NOT_FOUND");

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: "MEMBER", staffRole: null },
  });

  if (target.auth0Id && isAuth0ManagementConfigured()) {
    const allRoles = await auth0Management.listRoles();
    const parkRoleIds = allRoles
      .filter((r) => AUTH0_ROLE_DEFINITIONS.some((d) => d.name === r.name))
      .map((r) => r.id);
    if (parkRoleIds.length > 0) {
      await auth0Management.removeUserRoles(target.auth0Id, parkRoleIds);
    }
    await auth0Management.updateAppMetadata(target.auth0Id, {
      staff_role: null,
      staff_modules: [],
    });
  }
}

export { resolveStaffRole };
