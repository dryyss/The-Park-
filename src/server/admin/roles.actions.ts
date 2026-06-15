"use server";

import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { assignStaffRole, revokeStaffAccess } from "@/server/auth/roles.service";
import { isOwner } from "@/server/auth/permissions.service";
import type { AdminRole } from "@/generated/prisma/client";

const assignSchema = z.object({
  targetUserId: z.string().min(1),
  staffRole: z.enum(["OWNER", "MODERATOR", "CATALOG_MANAGER", "SHOP_MANAGER", "SUPPORT"]),
});

export type RoleActionResult = { ok: true } | { ok: false; error: string };

export async function assignStaffRoleAction(input: unknown): Promise<RoleActionResult> {
  const actor = await getAuthenticatedViewer();
  if (!actor || !isOwner(actor)) return { ok: false, error: "FORBIDDEN" };

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await assignStaffRole(actor.id, parsed.data.targetUserId, parsed.data.staffRole as AdminRole);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    return { ok: false, error: msg };
  }
}

export async function revokeStaffRoleAction(targetUserId: string): Promise<RoleActionResult> {
  const actor = await getAuthenticatedViewer();
  if (!actor || !isOwner(actor)) return { ok: false, error: "FORBIDDEN" };

  try {
    await revokeStaffAccess(actor.id, targetUserId);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    return { ok: false, error: msg };
  }
}

export async function setupAuth0RolesAction(): Promise<
  { ok: true; created: string[]; existing: string[] } | { ok: false; error: string }
> {
  const actor = await getAuthenticatedViewer();
  if (!actor || !isOwner(actor)) return { ok: false, error: "FORBIDDEN" };

  try {
    const { ensureAuth0RolesExist } = await import("@/server/auth/roles.service");
    const result = await ensureAuth0RolesExist();
    return { ok: true, ...result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    return { ok: false, error: msg };
  }
}
