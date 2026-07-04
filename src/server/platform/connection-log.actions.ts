"use server";

import { cookies } from "next/headers";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { getClientIp, getUserAgent } from "@/lib/rate-limit";
import { recordConnection } from "@/server/platform/connection-log.service";

const CONNECTION_COOKIE = "tp_conn";
/** Une entrée de journal au plus par session navigateur de 12 h. */
const CONNECTION_TTL_SEC = 60 * 60 * 12;

/**
 * Enregistre une connexion (LCEN) au plus une fois par session navigateur.
 * Appelée depuis le client au montage ; la dédup se fait via un cookie de session
 * httpOnly, ce qui évite d'écrire à chaque navigation ou rendu.
 */
export async function logConnectionAction(): Promise<void> {
  const jar = await cookies();
  if (jar.get(CONNECTION_COOKIE)) return;

  const viewer = await getAuthenticatedViewer();
  if (!viewer) return;

  const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  await recordConnection({ userId: viewer.id, ip, userAgent, action: "LOGIN" });

  jar.set(CONNECTION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CONNECTION_TTL_SEC,
    path: "/",
  });
}
