import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWebPush, isWebPushConfigured } from "@/lib/web-push";

export { isWebPushConfigured };

/** Enregistre (ou rafraîchit) un abonnement Web Push pour un navigateur. */
export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
    // Réassocie l'endpoint au membre courant (partage d'appareil, reconnexion).
    update: { userId: input.userId, p256dh: input.p256dh, auth: input.auth },
  });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envoie une notification push à tous les navigateurs d'un membre.
 * Purge les abonnements périmés (410/404). Best-effort : n'interrompt jamais l'appelant.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isWebPushConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const results = await Promise.all(
    subs.map((s) =>
      sendWebPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload).then((r) => ({
        endpoint: s.endpoint,
        r,
      })),
    ),
  );

  const gone = results.filter((x) => x.r === "gone").map((x) => x.endpoint);
  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } });
  }
}
