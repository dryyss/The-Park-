import { NextResponse } from "next/server";
import { expireDueListings } from "@/server/marketplace/marketplace.mutations";
import { settleDueAuctions } from "@/server/auction/auction.mutations";
import { purgeExpiredShipmentProofs } from "@/server/c2c/shipment.service";
import { processExchangeTimeouts } from "@/server/c2c/exchange-lifecycle.service";

export const dynamic = "force-dynamic";

/** Job interne — protégé par CRON_SECRET. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [expiredListings, settledAuctions, purgedProofs, exchangeTimeouts] = await Promise.all([
    expireDueListings(),
    settleDueAuctions(),
    purgeExpiredShipmentProofs(),
    processExchangeTimeouts(),
  ]);

  return NextResponse.json({ expiredListings, settledAuctions, purgedProofs, exchangeTimeouts });
}
