import "server-only";
import type { AdminRole, UserRole } from "@/generated/prisma/client";
import { MODULES_BY_STAFF_ROLE, type AdminModule } from "@/server/auth/roles.definition";

export interface StaffIdentity {
  role: UserRole;
  staffRole: AdminRole | null;
}

/** Résout le sous-rôle effectif (seed legacy : role ADMIN sans staffRole → OWNER). */
export function resolveStaffRole(user: StaffIdentity): AdminRole | null {
  if (user.staffRole) return user.staffRole;
  if (user.role === "ADMIN") return "OWNER";
  if (user.role === "MODERATOR") return "MODERATOR";
  return null;
}

export function isStaffMember(user: StaffIdentity): boolean {
  return resolveStaffRole(user) != null;
}

export function hasModuleAccess(user: StaffIdentity, module: AdminModule): boolean {
  const staffRole = resolveStaffRole(user);
  if (!staffRole) return false;
  return MODULES_BY_STAFF_ROLE[staffRole].includes(module);
}

export function getAccessibleModules(user: StaffIdentity): AdminModule[] {
  const staffRole = resolveStaffRole(user);
  if (!staffRole) return [];
  return MODULES_BY_STAFF_ROLE[staffRole];
}

export function isOwner(user: StaffIdentity): boolean {
  return resolveStaffRole(user) === "OWNER";
}
