import { NextResponse } from "next/server";
import { expireDueListings } from "@/server/marketplace/marketplace.mutations";
import { settleDueAuctions } from "@/server/auction/auction.mutations";
import { purgeExpiredShipmentProofs } from "@/server/c2c/shipment.service";
import { processExchangeTimeouts } from "@/server/c2c/exchange-lifecycle.service";
import { processSaleTimeouts } from "@/server/sale/sale-lifecycle.service";
import { purgeExpiredCartItems } from "@/server/marketplace-cart/marketplace-cart.service";
import { evaluateLeaderboardBadges } from "@/server/badge/badge.service";
import { purgeExpiredRateLimitHits } from "@/lib/rate-limit";
import { purgeExpiredConnectionLogs } from "@/server/platform/connection-log.service";

export const dynamic = "force-dynamic";

async function runMaintenance() {
  const [
    expiredListings,
    settledAuctions,
    purgedProofs,
    exchangeTimeouts,
    saleTimeouts,
    purgedCartItems,
    leaderboardBadges,
    purgedRateLimits,
    purgedConnectionLogs,
  ] = await Promise.all([
    expireDueListings(),
    settleDueAuctions(),
    purgeExpiredShipmentProofs(),
    processExchangeTimeouts(),
    processSaleTimeouts(),
    purgeExpiredCartItems(),
    // Succès de classement (Midnight Club, Drift King, Roi de la Glisse) :
    // évalués chaque jour pour le haut du leaderboard, sans attendre une visite.
    evaluateLeaderboardBadges(),
    purgeExpiredRateLimitHits(),
    // LCEN : conservation 1 an des journaux de connexion.
    purgeExpiredConnectionLogs(),
  ]);

  return {
    expiredListings,
    settledAuctions,
    purgedProofs,
    exchangeTimeouts,
    saleTimeouts,
    purgedCartItems,
    leaderboardBadges,
    purgedRateLimits,
    purgedConnectionLogs,
  };
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Vercel Cron envoie GET ; schedulers externes peuvent utiliser POST. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const result = await runMaintenance();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const result = await runMaintenance();
  return NextResponse.json(result);
}
