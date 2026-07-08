import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { isCellarReady, isCellarUrl, cellarPut, cellarDelete } from "@/lib/cellar";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const UPLOAD_ROOT = path.join(process.cwd(), "public/uploads/collection");

function isBlobReady(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function collectionPhotoPublicPath(collectionItemId: string, fileName: string): string {
  return `/uploads/collection/${collectionItemId}/${fileName}`;
}

async function prepareImageBuffer(
  file: File,
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  if (file.size > MAX_BYTES) throw new Error("FILE_TOO_LARGE");
  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error("INVALID_TYPE");

  const raw = Buffer.from(await file.arrayBuffer());
  try {
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(raw)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return { buffer: jpeg, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    // sharp unavailable on this runtime — use raw buffer
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    return { buffer: raw, contentType: mime, ext: extMap[mime] ?? "jpg" };
  }
}

export async function saveCollectionPhotoFile(
  collectionItemId: string,
  file: File,
): Promise<string> {
  const { buffer, contentType, ext } = await prepareImageBuffer(file);
  const fileName = `${randomUUID()}.${ext}`;

  if (isCellarReady()) {
    return cellarPut(`collection/${collectionItemId}/${fileName}`, buffer, contentType);
  }

  if (isBlobReady()) {
    const blob = await put(`collection/${collectionItemId}/${fileName}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  if (process.env.VERCEL) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  const dir = path.join(UPLOAD_ROOT, collectionItemId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return collectionPhotoPublicPath(collectionItemId, fileName);
}

export async function deleteCollectionPhotoFile(publicUrl: string): Promise<void> {
  if (isCellarUrl(publicUrl)) {
    await cellarDelete(publicUrl);
    return;
  }
  if (isBlobReady() && publicUrl.startsWith("https://")) {
    try {
      await del(publicUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // best-effort
    }
    return;
  }
  if (!publicUrl.startsWith("/uploads/collection/")) return;
  const full = path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  try {
    await unlink(full);
  } catch {
    // file already gone
  }
}
