import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { isPusherConfigured } from "@/lib/pusher";

export const dynamic = "force-dynamic";

/** Autorise l'abonnement au canal privé `private-user-{viewerId}` uniquement. */
export async function POST(request: Request) {
  if (!isPusherConfigured()) {
    return NextResponse.json({ error: "PUSHER_NOT_CONFIGURED" }, { status: 503 });
  }

  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.formData();
  const socketId = body.get("socket_id");
  const channelName = body.get("channel_name");

  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const expectedChannel = `private-user-${viewer.id}`;
  if (channelName !== expectedChannel) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const key = process.env.PUSHER_KEY!;
  const secret = process.env.PUSHER_SECRET!;
  const signature = createHmac("sha256", secret).update(`${socketId}:${channelName}`).digest("hex");

  return NextResponse.json({ auth: `${key}:${signature}` });
}
