import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { prisma } from "@/lib/prisma";
import { isCellarReady, cellarPresignPut } from "@/lib/cellar";

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  shipmentId: z.string().min(1),
  contentType: z.string().min(1),
});

/**
 * Génère une URL présignée Cellar (S3) pour l'upload direct navigateur → stockage
 * d'une vidéo de preuve C2C. Le corps volumineux (jusqu'à 200 Mo) ne transite jamais
 * par le serveur : le client PUT directement sur l'URL présignée.
 */
export async function POST(request: Request) {
  if (!isCellarReady()) {
    return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const mediaType = parsed.contentType.toLowerCase();
  if (!ALLOWED_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
  }

  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Expéditeur (preuves d'emballage/dépôt) ou destinataire (déballage filmé).
  const shipment = await prisma.shipment.findFirst({
    where: {
      id: parsed.shipmentId,
      OR: [{ shipperId: viewer.id }, { recipientId: viewer.id }],
    },
    select: { id: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const ext = EXT_BY_TYPE[mediaType] ?? "mp4";
  const key = `proofs/${parsed.shipmentId}/${randomUUID()}.${ext}`;

  try {
    const { uploadUrl, publicUrl } = await cellarPresignPut(key, mediaType);
    return NextResponse.json({ uploadUrl, publicUrl, maxBytes: MAX_BYTES });
  } catch {
    return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }
}
