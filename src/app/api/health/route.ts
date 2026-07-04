import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuth0Configured, isStripeConfigured } from "@/lib/env";
import { isResendConfigured } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sonde de préparation prod : indique quelles intégrations sont configurées et
 * si la base répond. Consommable par un uptime-check ou une checklist de release.
 * Aucune donnée sensible n'est exposée (booléens de présence uniquement).
 */
export async function GET() {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch (err) {
    console.error("[health] base injoignable", err);
  }

  const checks = {
    database,
    auth0: isAuth0Configured(),
    stripe: isStripeConfigured(),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    resend: isResendConfigured(),
    pusher: Boolean(process.env.PUSHER_APP_ID?.trim() && process.env.NEXT_PUBLIC_PUSHER_KEY?.trim()),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    appBaseUrl: Boolean((process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim()),
  };

  // « ready » = tout ce qui est indispensable pour un déploiement prod sain.
  const ready = checks.database && checks.auth0 && checks.stripe && checks.stripeWebhook;

  return NextResponse.json(
    { ready, checks, ts: new Date().toISOString() },
    { status: ready ? 200 : 503 },
  );
}
