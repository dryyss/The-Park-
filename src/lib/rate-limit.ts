import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface RateLimitOptions {
  /** Nombre de requêtes autorisées par fenêtre. */
  limit: number;
  /** Durée de la fenêtre en secondes. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  /** Secondes avant réouverture (0 si autorisé). */
  retryAfterSec: number;
}

/**
 * Compteur de fenêtre fixe backé Postgres — correct en multi-instances (Vercel
 * serverless), contrairement à un compteur en mémoire par instance.
 *
 * Politique de panne : **fail-open**. Un incident base ne doit jamais bloquer un
 * utilisateur légitime ; le rate-limit protège d'un abus, ce n'est pas un contrôle
 * d'accès (celui-ci reste la signature/auth de chaque endpoint).
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const key = `${scope}:${identifier}`;

  try {
    const row = await prisma.rateLimitHit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    const ok = row.count <= opts.limit;
    const remaining = Math.max(0, opts.limit - row.count);
    const retryAfterSec = ok ? 0 : Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
    return { ok, remaining, limit: opts.limit, retryAfterSec };
  } catch (err) {
    console.error("[rate-limit] fail-open sur incident base", err);
    return { ok: true, remaining: opts.limit, limit: opts.limit, retryAfterSec: 0 };
  }
}

/** Réponse 429 normalisée (JSON + en-tête Retry-After). */
export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "RATE_LIMITED", retryAfter: result.retryAfterSec },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

/** IP client réelle derrière le proxy Vercel (X-Forwarded-For → premier hop). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** User-Agent client (tronqué pour la journalisation). */
export async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  const ua = h.get("user-agent");
  return ua ? ua.slice(0, 400) : null;
}

/** Purge des compteurs expirés (appelée par le cron de maintenance). */
export async function purgeExpiredRateLimitHits(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
  const { count } = await prisma.rateLimitHit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return count;
}
