import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { sendConversationMessage } from "@/server/messaging/messaging.mutations";
import { saveMessagePhotoFile } from "@/lib/message-photo-storage";
import { MAX_MESSAGE_PHOTOS } from "@/lib/message-photos.constants";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

function revalidateMessaging(conversationId: string) {
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
}

async function assertParticipant(userId: string, conversationId: string) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!p) throw new Error("FORBIDDEN");
}

/** Envoi multipart : texte + jusqu'à 4 photos. */
export async function POST(request: Request) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = await rateLimit("messages-send", viewer.id, { limit: 20, windowSec: 60 });
  if (!rl.ok) return tooManyRequests(rl);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_FORM" }, { status: 400 });
  }

  const conversationId = String(form.get("conversationId") ?? "");
  const body = String(form.get("body") ?? "");
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "VALIDATION" }, { status: 400 });
  }
  if (files.length > MAX_MESSAGE_PHOTOS) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_ATTACHMENTS" }, { status: 400 });
  }

  try {
    await assertParticipant(viewer.id, conversationId);

    const attachmentUrls: string[] = [];
    for (const file of files) {
      attachmentUrls.push(await saveMessagePhotoFile(conversationId, file));
    }

    const messageId = await sendConversationMessage(viewer.id, conversationId, body, attachmentUrls);
    revalidateMessaging(conversationId);
    return NextResponse.json({ ok: true, messageId, attachments: attachmentUrls });
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    const status =
      code === "FORBIDDEN"
        ? 403
        : code === "EMPTY_MESSAGE" ||
            code === "TOO_LONG" ||
            code === "TOO_MANY_ATTACHMENTS" ||
            code === "FILE_TOO_LARGE" ||
            code === "INVALID_TYPE"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
