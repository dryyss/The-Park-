import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2000;
const UPLOAD_ROOT = path.join(process.cwd(), "public/uploads");

function safeBaseName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  return (
    base
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "image"
  );
}

function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function processImageToJpeg(file: File): Promise<Buffer> {
  if (file.size > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("INVALID_TYPE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sharp = (await import("sharp")).default;
  try {
    return await sharp(buffer)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch (err) {
    console.error("[admin-upload] sharp failed", err);
    throw new Error("IMAGE_PROCESS_FAILED");
  }
}

/**
 * Enregistre une image admin (catalogue / boutique).
 * - Prod Vercel : Vercel Blob (BLOB_READ_WRITE_TOKEN) → URL HTTPS publique
 * - Dev local : public/uploads → nom de fichier seul
 */
export async function saveAdminImageFile(file: File): Promise<string> {
  const jpeg = await processImageToJpeg(file);
  const fileName = `${safeBaseName(file.name)}-${randomUUID().slice(0, 8)}.jpg`;

  if (useBlobStorage()) {
    try {
      const blob = await put(`admin/${fileName}`, jpeg, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      console.error("[admin-upload] blob put failed", err);
      if (msg.includes("token") || msg.includes("unauthorized") || msg.includes("forbidden")) {
        throw new Error("STORAGE_NOT_CONFIGURED");
      }
      throw new Error("UPLOAD_FAILED");
    }
  }

  if (process.env.VERCEL) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  try {
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(path.join(UPLOAD_ROOT, fileName), jpeg);
  } catch {
    throw new Error("WRITE_FAILED");
  }

  return fileName;
}
