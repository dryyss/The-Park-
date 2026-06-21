import { NextResponse } from "next/server";
import { z } from "zod";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireModule } from "@/server/auth/admin-guard";
import type { AdminModule } from "@/server/auth/roles.definition";
import { getAdminImageUploadMode, saveAdminImageFile } from "@/lib/admin-image-storage";

const scopeSchema = z.enum(["catalog", "shop"]);
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MODULE_BY_SCOPE: Record<z.infer<typeof scopeSchema>, AdminModule> = {
  catalog: "catalog",
  shop: "shop",
};

export const runtime = "nodejs";
export const maxDuration = 30;

async function assertScopeAccess(scope: z.infer<typeof scopeSchema>) {
  const access = await requireModule(MODULE_BY_SCOPE[scope]);
  if (!access.ok) {
    return access.reason === "UNAUTHORIZED" ? ("UNAUTHORIZED" as const) : ("FORBIDDEN" as const);
  }
  return null;
}

function parseScopeFromPayload(clientPayload: string | null): z.infer<typeof scopeSchema> | null {
  if (!clientPayload) return "catalog";
  try {
    const raw = JSON.parse(clientPayload) as { scope?: unknown };
    const parsed = scopeSchema.safeParse(raw.scope ?? "catalog");
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function handleBlobClientUpload(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const scope = parseScopeFromPayload(clientPayload);
      if (!scope) throw new Error("VALIDATION");
      const denied = await assertScopeAccess(scope);
      if (denied) throw new Error(denied);

      return {
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ scope }),
      };
    },
  });

  return NextResponse.json(jsonResponse);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    if (getAdminImageUploadMode() !== "blob") {
      return NextResponse.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
    }
    try {
      return await handleBlobClientUpload(request);
    } catch (err) {
      console.error("[admin-upload] blob client error", err);
      const code = err instanceof Error ? err.message : "UNKNOWN";
      const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: code }, { status });
    }
  }

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

  const denied = await assertScopeAccess(scopeParsed.data);
  if (denied) {
    return NextResponse.json({ ok: false, error: denied }, { status: denied === "UNAUTHORIZED" ? 401 : 403 });
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
