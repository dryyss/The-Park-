import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { searchMembers } from "@/server/friend/friend.service";

export const dynamic = "force-dynamic";

/** Recherche de membres (page Rivaux) — connecté uniquement. */
export async function GET(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchMembers(viewer.id, q);
  return NextResponse.json(results);
}
