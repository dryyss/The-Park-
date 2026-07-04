import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { deletePushSubscription } from "@/server/push/push.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supprime l'abonnement Web Push du navigateur courant. */
export async function POST(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  await deletePushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
