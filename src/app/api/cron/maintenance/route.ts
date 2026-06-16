import { NextResponse } from "next/server";
import { expireDueListings } from "@/server/marketplace/marketplace.mutations";
import { purgeExpiredShipmentProofs } from "@/server/c2c/shipment.service";

export const dynamic = "force-dynamic";

/** Job interne — protégé par CRON_SECRET. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [expiredListings, purgedProofs] = await Promise.all([
    expireDueListings(),
    purgeExpiredShipmentProofs(),
  ]);

  return NextResponse.json({ expiredListings, purgedProofs });
}
