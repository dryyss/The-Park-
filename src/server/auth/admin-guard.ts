import "server-only";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  hasModuleAccess,
  isStaffMember,
  type StaffIdentity,
} from "@/server/auth/permissions.service";
import type { AdminModule } from "@/server/auth/roles.definition";

export type StaffViewer = NonNullable<Awaited<ReturnType<typeof getAuthenticatedViewer>>>;

export async function requireAuthenticatedStaff(): Promise<
  { ok: true; user: StaffViewer } | { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }
> {
  const user = await getAuthenticatedViewer();
  if (!user) return { ok: false, reason: "UNAUTHORIZED" };
  if (!isStaffMember(user)) return { ok: false, reason: "FORBIDDEN" };
  return { ok: true, user };
}

export async function requireModule(module: AdminModule): Promise<
  { ok: true; user: StaffViewer } | { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }
> {
  const user = await getAuthenticatedViewer();
  if (!user) return { ok: false, reason: "UNAUTHORIZED" };
  if (!hasModuleAccess(user, module)) return { ok: false, reason: "FORBIDDEN" };
  return { ok: true, user };
}

export function canAccessModule(user: StaffIdentity, module: AdminModule): boolean {
  return hasModuleAccess(user, module);
}
