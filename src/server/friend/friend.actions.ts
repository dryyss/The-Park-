"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import {
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
} from "@/server/friend/friend.service";
import { prisma } from "@/lib/prisma";

export type FriendActionResult = { ok: true } | { ok: false; error: string };

export async function sendFriendRequestAction(addresseeSlug: string): Promise<FriendActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const addressee = await prisma.user.findFirst({
    where: { slug: addresseeSlug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!addressee) return { ok: false, error: "NOT_FOUND" };

  try {
    await sendFriendRequest(viewer.id, addressee.id);
    revalidatePath(`/collectionneur/${addresseeSlug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function acceptFriendRequestAction(friendshipId: string): Promise<FriendActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await acceptFriendRequest(viewer.id, friendshipId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function removeFriendshipAction(friendshipId: string): Promise<FriendActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await removeFriendship(viewer.id, friendshipId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
