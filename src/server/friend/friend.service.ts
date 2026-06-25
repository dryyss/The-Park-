import "server-only";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/server/notification/notification.mutations";

export type FriendshipView =
  | "NONE"
  | "PENDING_SENT"
  | "PENDING_RECEIVED"
  | "ACCEPTED";

export interface FriendEntry {
  id: string; // friendshipId
  userId: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
}

export interface FriendRequest {
  id: string; // friendshipId
  requesterId: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  createdAt: Date;
}

/** Retourne l'état de la relation entre viewerId et targetId. */
export async function getFriendshipStatus(
  viewerId: string,
  targetId: string,
): Promise<FriendshipView> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: targetId },
        { requesterId: targetId, addresseeId: viewerId },
      ],
    },
    select: { status: true, requesterId: true },
  });
  if (!friendship) return "NONE";
  if (friendship.status === "ACCEPTED") return "ACCEPTED";
  return friendship.requesterId === viewerId ? "PENDING_SENT" : "PENDING_RECEIVED";
}

/** Envoie une demande d'amitié. */
export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  if (requesterId === addresseeId) throw new Error("SELF_FRIEND");

  const [target, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: addresseeId }, select: { allowFriendRequests: true } }),
    prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    }),
  ]);
  if (!target?.allowFriendRequests) throw new Error("FRIEND_REQUESTS_DISABLED");
  if (existing) throw new Error("ALREADY_EXISTS");

  await prisma.friendship.create({ data: { requesterId, addresseeId } });

  await dispatchNotification({
    userId: addresseeId,
    type: "FRIEND_REQUEST",
    actorId: requesterId,
    entityType: "USER",
    entityId: requesterId,
  });
}

/** Accepte une demande reçue. */
export async function acceptFriendRequest(addresseeId: string, friendshipId: string): Promise<void> {
  const f = await prisma.friendship.findFirst({
    where: { id: friendshipId, addresseeId, status: "PENDING" },
    select: { id: true, requesterId: true },
  });
  if (!f) throw new Error("NOT_FOUND");

  await prisma.friendship.update({
    where: { id: f.id },
    data: { status: "ACCEPTED" },
  });

  await dispatchNotification({
    userId: f.requesterId,
    type: "FRIEND_ACCEPTED",
    actorId: addresseeId,
    entityType: "USER",
    entityId: addresseeId,
  });
}

/** Refuse ou supprime une amitié. */
export async function removeFriendship(userId: string, friendshipId: string): Promise<void> {
  await prisma.friendship.deleteMany({
    where: {
      id: friendshipId,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

/** Liste des amis acceptés. */
export async function getFriends(userId: string): Promise<FriendEntry[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, displayName: true, slug: true, avatarUrl: true } },
      addressee: { select: { id: true, displayName: true, slug: true, avatarUrl: true } },
    },
  });

  return friendships.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    return { id: f.id, userId: other.id, displayName: other.displayName, slug: other.slug, avatarUrl: other.avatarUrl };
  });
}

/** Demandes reçues en attente. */
export async function getPendingFriendRequests(userId: string): Promise<FriendRequest[]> {
  const friendships = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, displayName: true, slug: true, avatarUrl: true } },
    },
  });

  return friendships.map((f) => ({
    id: f.id,
    requesterId: f.requesterId,
    displayName: f.requester.displayName,
    slug: f.requester.slug,
    avatarUrl: f.requester.avatarUrl,
    createdAt: f.createdAt,
  }));
}

/** IDs des amis pour filtrer le marketplace. */
export async function getFriendUserIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  return friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
}
