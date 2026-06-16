import "server-only";

export function isPusherConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.PUSHER_CLUSTER,
  );
}

/** Pousse un événement temps réel sur le canal privé utilisateur (best-effort). */
export async function pushUserEvent(userId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  if (!isPusherConfigured()) return;

  const auth = Buffer.from(`${process.env.PUSHER_KEY}:${process.env.PUSHER_SECRET}`).toString("base64");
  const path = `/apps/${process.env.PUSHER_APP_ID}/events`;
  const body = JSON.stringify({
    name: event,
    channels: [`private-user-${userId}`],
    data: JSON.stringify(payload),
  });

  const res = await fetch(`https://api-${process.env.PUSHER_CLUSTER}.pusher.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    console.error("[pusher] trigger failed", res.status, await res.text());
  }
}
