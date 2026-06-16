import "server-only";
import type { AdminRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auth0Management, isAuth0ManagementConfigured } from "@/lib/auth0-management";
import {
  AUTH0_ROLE_DEFINITIONS,
  MODULES_BY_STAFF_ROLE,
  mapAuth0RoleNames,
  staffRoleToAuth0Name,
} from "@/server/auth/roles.definition";
import { isOwner, resolveStaffRole } from "@/server/auth/permissions.service";

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
  const NAMESPACE = "https://thepark.app";
  let roleNames: string[] = [];
  let metadataRole: AdminRole | null = null;
  let claimRole: AdminRole | null = null;
  let mgmtOk = false;

  const claim = sessionUser?.[`${NAMESPACE}/staff_role`];
  if (typeof claim === "string") {
    claimRole = claim as AdminRole;
  }

  if (isAuth0ManagementConfigured()) {
    try {
      const [roles, user] = await Promise.all([
        auth0Management.getUserRoles(auth0Id),
        auth0Management.getUser(auth0Id),
      ]);
      roleNames = roles.map((r) => r.name);
      mgmtOk = true;
      const meta = user.app_metadata?.staff_role;
      if (typeof meta === "string") {
        metadataRole = meta as AdminRole;
      }
    } catch (err) {
      console.error("[roles] sync Auth0 Management API", err);
    }
  }

  const mapped = mapAuth0RoleNames(roleNames);

  const fallbackRole = claimRole ?? metadataRole;
  if (!mapped.staffRole && fallbackRole) {
    const def = AUTH0_ROLE_DEFINITIONS.find((d) => d.staffRole === fallbackRole);
    if (def) {
      mapped.staffRole = fallbackRole;
      mapped.userRole = def.userRole;
    }
  }

  // Sans source Auth0 fiable, ne pas écraser un staff déjà présent en DB (seed / admin).
  const hasAuth0Roles = roleNames.length > 0 || fallbackRole != null;
  if (!mgmtOk && !hasAuth0Roles) {
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { auth0Id },
    select: { staffRole: true, role: true },
  });
  if (!existing) return;

  if (!hasAuth0Roles && existing.staffRole) {
    return;
  }

  await prisma.user.update({
    where: { auth0Id },
    data: {
      role: mapped.staffRole ? mapped.userRole : existing.role,
      staffRole: mapped.staffRole ?? (hasAuth0Roles ? null : existing.staffRole),
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
