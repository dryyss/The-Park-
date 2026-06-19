import "server-only";
import { prisma } from "@/lib/prisma";
import { isStaffMember } from "@/server/auth/permissions.service";

/** Charge la cible et applique les garde-fous communs (pas soi-même, pas un staff). */
async function ensureActionable(moderatorId: string, userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, staffRole: true },
  });
  if (!target) throw new Error("NOT_FOUND");
  if (target.id === moderatorId) throw new Error("SELF_ACTION");
  // Un membre du staff (modérateur, owner…) ne se gère pas via cet écran : passer par les rôles.
  if (isStaffMember({ role: target.role, staffRole: target.staffRole })) throw new Error("TARGET_IS_STAFF");
  return target;
}

export async function suspendUser(
  moderatorId: string,
  userId: string,
  until?: Date | null,
  reason?: string,
): Promise<void> {
  await ensureActionable(moderatorId, userId);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED", suspendedUntil: until ?? null },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "USER_SUSPENDED",
        targetType: "USER",
        targetId: userId,
        targetUserId: userId,
        details: { until: until ? until.toISOString() : null, reason: reason ?? null },
      },
    });
  });
}

export async function reactivateUser(moderatorId: string, userId: string): Promise<void> {
  await ensureActionable(moderatorId, userId);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", suspendedUntil: null, bannedAt: null },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "USER_REACTIVATED",
        targetType: "USER",
        targetId: userId,
        targetUserId: userId,
      },
    });
  });
}

export async function banUser(moderatorId: string, userId: string, reason?: string): Promise<void> {
  await ensureActionable(moderatorId, userId);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: "BANNED", bannedAt: new Date(), suspendedUntil: null },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "USER_BANNED",
        targetType: "USER",
        targetId: userId,
        targetUserId: userId,
        details: { reason: reason ?? null },
      },
    });
  });
}
