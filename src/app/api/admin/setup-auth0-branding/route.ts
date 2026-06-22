import { NextResponse } from "next/server";
import { requireAuthenticatedStaff } from "@/server/auth/admin-guard";
import { auth0Management, isAuth0ManagementConfigured } from "@/lib/auth0-management";

export async function POST() {
  const guard = await requireAuthenticatedStaff();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.reason === "UNAUTHORIZED" ? 401 : 403 });
  }

  if (!isAuth0ManagementConfigured()) {
    return NextResponse.json({ error: "Management API non configurée" }, { status: 503 });
  }

  try {
    await auth0Management.applyTheParkBranding();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[setup-auth0-branding]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UNKNOWN" },
      { status: 500 },
    );
  }
}
