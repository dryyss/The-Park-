import { NextResponse } from "next/server";
import { z } from "zod";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: blobToken,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const viewer = await getAuthenticatedViewer();
        if (!viewer) throw new Error("UNAUTHORIZED");

        const payload = z
          .object({ shipmentId: z.string().min(1) })
          .safeParse(JSON.parse(clientPayload ?? "{}"));
        if (!payload.success) throw new Error("VALIDATION");

        // Expéditeur (preuves d'emballage/dépôt) ou destinataire (déballage filmé).
        const shipment = await prisma.shipment.findFirst({
          where: {
            id: payload.data.shipmentId,
            OR: [{ shipperId: viewer.id }, { recipientId: viewer.id }],
          },
          select: { id: true },
        });
        if (!shipment) throw new Error("FORBIDDEN");

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ shipmentId: payload.data.shipmentId, userId: viewer.id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    const status = code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
