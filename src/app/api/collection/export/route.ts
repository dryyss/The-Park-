import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  getCollectionExportRows,
  collectionRowsToCsv,
  collectionRowsToJson,
} from "@/server/collection/collection-export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export de la collection du membre connecté (CSV ou JSON). */
export async function GET(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rl = await rateLimit("collection-export", viewer.id, { limit: 10, windowSec: 60 });
  if (!rl.ok) return tooManyRequests(rl);

  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";
  const rows = await getCollectionExportRows(viewer.id);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `the-park-collection-${stamp}.${format}`;

  const body = format === "json" ? collectionRowsToJson(rows) : collectionRowsToCsv(rows);
  const contentType = format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8";

  return new NextResponse(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
