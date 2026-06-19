"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import { suspendUser, reactivateUser, banUser } from "@/server/admin/users.mutations";

export type UserActionResult = { ok: true } | { ok: false; error: string };

const suspendSchema = z.object({
  userId: z.string().min(1),
  until: z.string().datetime().nullish(),
  reason: z.string().trim().max(500).optional(),
});

const userIdSchema = z.object({ userId: z.string().min(1) });

const banSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

function revalidateUsers() {
  revalidatePath("/admin/utilisateurs");
}

export async function suspendUserAction(input: unknown): Promise<UserActionResult> {
  const access = await requireModule("users");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await suspendUser(
      access.user.id,
      parsed.data.userId,
      parsed.data.until ? new Date(parsed.data.until) : null,
      parsed.data.reason,
    );
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function reactivateUserAction(input: unknown): Promise<UserActionResult> {
  const access = await requireModule("users");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await reactivateUser(access.user.id, parsed.data.userId);
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function banUserAction(input: unknown): Promise<UserActionResult> {
  const access = await requireModule("users");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await banUser(access.user.id, parsed.data.userId, parsed.data.reason);
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
