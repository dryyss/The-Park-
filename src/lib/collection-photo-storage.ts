import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const UPLOAD_ROOT = path.join(process.cwd(), "public/uploads/collection");

export function collectionPhotoPublicPath(collectionItemId: string, fileName: string): string {
  return `/uploads/collection/${collectionItemId}/${fileName}`;
}

/** Compresse et enregistre une photo d'exemplaire (JPEG). */
export async function saveCollectionPhotoFile(collectionItemId: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("INVALID_TYPE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(UPLOAD_ROOT, collectionItemId);
  await mkdir(dir, { recursive: true });

  const fileName = `${randomUUID()}.jpg`;
  const outPath = path.join(dir, fileName);

  await sharp(buffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(outPath);

  return collectionPhotoPublicPath(collectionItemId, fileName);
}

export async function deleteCollectionPhotoFile(publicUrl: string): Promise<void> {
  if (!publicUrl.startsWith("/uploads/collection/")) return;
  const full = path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  try {
    await unlink(full);
  } catch {
    // fichier déjà absent
  }
}
