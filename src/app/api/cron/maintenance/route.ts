import { NextResponse } from "next/server";
import { expireDueListings } from "@/server/marketplace/marketplace.mutations";
import { settleDueAuctions } from "@/server/auction/auction.mutations";
import { purgeExpiredShipmentProofs } from "@/server/c2c/shipment.service";
import { processExchangeTimeouts } from "@/server/c2c/exchange-lifecycle.service";
import { processSaleTimeouts } from "@/server/sale/sale-lifecycle.service";

export const dynamic = "force-dynamic";

async function runMaintenance() {
  const [expiredListings, settledAuctions, purgedProofs, exchangeTimeouts, saleTimeouts] = await Promise.all([
    expireDueListings(),
    settleDueAuctions(),
    purgeExpiredShipmentProofs(),
    processExchangeTimeouts(),
    processSaleTimeouts(),
  ]);

  return { expiredListings, settledAuctions, purgedProofs, exchangeTimeouts, saleTimeouts };
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
