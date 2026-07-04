import { NextResponse } from "next/server";
import { subscribeToNewsletter } from "@/server/newsletter/newsletter.service";
import { rateLimit, tooManyRequests, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inscription newsletter (footer) — double opt-in, rate-limité par IP. */
export async function POST(request: Request) {
  const ip = await getClientIp();
  const rl = await rateLimit("newsletter", ip, { limit: 5, windowSec: 300 });
  if (!rl.ok) return tooManyRequests(rl);

  let payload: { email?: unknown; locale?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email : "";
  const locale = typeof payload.locale === "string" ? payload.locale : "fr";

  try {
    const result = await subscribeToNewsletter(email, locale);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: code },
      { status: code === "INVALID_EMAIL" ? 400 : 500 },
    );
  }
}
