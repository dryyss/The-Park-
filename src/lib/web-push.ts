import "server-only";
import webpush from "web-push";

let configured = false;

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!isWebPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:contact@thepark.app",
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  configured = true;
  return true;
}

export interface WebPushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type WebPushSendResult = "sent" | "gone" | "error" | "skipped";

/** Envoie une notification push ; renvoie "gone" si l'abonnement est périmé (à purger). */
export async function sendWebPush(target: WebPushTarget, payload: unknown): Promise<WebPushSendResult> {
  if (!ensureConfigured()) return "skipped";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: target.keys },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 : l'abonnement n'existe plus côté navigateur → le supprimer.
    if (status === 404 || status === 410) return "gone";
    console.error("[web-push] envoi échoué", status, err);
    return "error";
  }
}
