import { NextResponse } from "next/server";
import { z } from "zod";
import { syncAuth0User } from "@/server/user/auth-sync.service";
import { syncRolesFromAuth0 } from "@/server/auth/roles.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  auth0Id: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().optional(),
});

/**
 * Trigger Auth0 Post-Login Action → synchronise compte Prisma + rôles staff.
 * Sécurisé par AUTH0_ACTION_SECRET (header Authorization: Bearer …).
 */
export async function POST(request: Request) {
  const secret = process.env.AUTH0_ACTION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Trigger non configuré" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const { auth0Id, email, name } = parsed.data;
  const cleanEmail = email && email.length > 0 ? email : undefined;

  try {
    await syncAuth0User({ sub: auth0Id, email: cleanEmail, name });
    await syncRolesFromAuth0(auth0Id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    console.error("[auth/roles/sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
