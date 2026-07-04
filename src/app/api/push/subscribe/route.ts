import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { savePushSubscription } from "@/server/push/push.service";
import { getUserAgent } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enregistre l'abonnement Web Push du navigateur courant. */
export async function POST(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    sub = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ ok: false, error: "INVALID_SUBSCRIPTION" }, { status: 400 });
  }

  await savePushSubscription({
    userId: viewer.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent: await getUserAgent(),
  });

  return NextResponse.json({ ok: true });
}
