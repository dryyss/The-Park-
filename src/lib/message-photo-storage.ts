import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isCellarReady, isCellarUrl, cellarPut, cellarDelete } from "@/lib/cellar";
import { MAX_MESSAGE_PHOTOS } from "@/lib/message-photos.constants";

export { MAX_MESSAGE_PHOTOS };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const UPLOAD_ROOT = path.join(process.cwd(), "public/uploads/messages");

export function messagePhotoPublicPath(conversationId: string, fileName: string): string {
  return `/uploads/messages/${conversationId}/${fileName}`;
}

export function isMessagePhotoUrl(conversationId: string, url: string): boolean {
  return url.startsWith(`/uploads/messages/${conversationId}/`);
}

/** Compresse et enregistre une photo de message (JPEG). */
export async function saveMessagePhotoFile(conversationId: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("FILE_TOO_LARGE");

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("INVALID_TYPE");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const fileName = `${randomUUID()}.jpg`;

  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(raw)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  if (isCellarReady()) {
    return cellarPut(`messages/${conversationId}/${fileName}`, jpeg, "image/jpeg");
  }

  const dir = path.join(UPLOAD_ROOT, conversationId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), jpeg);
  return messagePhotoPublicPath(conversationId, fileName);
}

export async function deleteMessagePhotoFile(publicUrl: string): Promise<void> {
  if (isCellarUrl(publicUrl)) {
    await cellarDelete(publicUrl);
    return;
  }
  if (!publicUrl.startsWith("/uploads/messages/")) return;
  const full = path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  try {
    await unlink(full);
  } catch {
    // fichier déjà absent
  }
}
