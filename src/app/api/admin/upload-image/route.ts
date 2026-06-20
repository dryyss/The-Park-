import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import type { AdminModule } from "@/server/auth/roles.definition";
import { saveAdminImageFile } from "@/lib/admin-image-storage";

const scopeSchema = z.enum(["catalog", "shop"]);

const MODULE_BY_SCOPE: Record<z.infer<typeof scopeSchema>, AdminModule> = {
  catalog: "catalog",
  shop: "shop",
};

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_FORM" }, { status: 400 });
  }

  const scopeParsed = scopeSchema.safeParse(String(form.get("scope") ?? "catalog"));
  if (!scopeParsed.success) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }

  const access = await requireModule(MODULE_BY_SCOPE[scopeParsed.data]);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.reason }, { status: access.reason === "UNAUTHORIZED" ? 401 : 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }

  try {
    const fileName = await saveAdminImageFile(file);
    return NextResponse.json({ ok: true, fileName });
  } catch (err) {
    console.error("[admin-upload] route error", err);
    const code = err instanceof Error ? err.message : "UNKNOWN";
    const status =
      code === "FILE_TOO_LARGE" || code === "INVALID_TYPE" || code === "IMAGE_PROCESS_FAILED" ? 400 : 500;
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
