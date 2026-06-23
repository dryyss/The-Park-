import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { deleteCollectionPhoto, uploadCollectionPhoto } from "@/server/collection/collection-photos.service";

const conditionEnum = z.enum(["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"]);

function revalidatePhotoPaths() {
  revalidatePath("/collection");
  revalidatePath("/carte", "layout");
}

export async function POST(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_FORM" }, { status: 400 });
  }

  const variantId = String(form.get("variantId") ?? "");
  const conditionParsed = conditionEnum.safeParse(String(form.get("condition") ?? ""));
  const kindParsed = z.enum(["CARD", "CERTIFICATE"]).safeParse(String(form.get("kind") ?? "CARD"));
  const file = form.get("file");

  if (!variantId || !conditionParsed.success || !kindParsed.success || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }

  try {
    const photo = await uploadCollectionPhoto(viewer.id, variantId, conditionParsed.data, file, kindParsed.data);
    revalidatePhotoPaths();
    return NextResponse.json({ ok: true, photo });
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    const status =
      code === "NOT_OWNED" || code === "FORBIDDEN"
        ? 403
        : code === "MAX_PHOTOS" || code === "FILE_TOO_LARGE" || code === "INVALID_TYPE" || code === "NOT_GRADED"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}

export async function DELETE(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = z.object({ photoId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }

  try {
    await deleteCollectionPhoto(viewer.id, parsed.data.photoId);
    revalidatePhotoPaths();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: code }, { status: code === "FORBIDDEN" ? 403 : 500 });
  }
}
