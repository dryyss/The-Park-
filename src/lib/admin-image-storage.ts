import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import type { AdminImageUploadMode } from "@/lib/admin-image-upload.types";

export type { AdminImageUploadMode };

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

function isBlobStorageReady(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function isAdminImageStorageReady(): boolean {
  return isBlobStorageReady();
}

export function getAdminImageUploadMode(): AdminImageUploadMode {
  if (isBlobStorageReady()) return "blob";
  if (!process.env.VERCEL) return "local";
  return "disabled";
}

export function safeAdminImageBaseName(originalName: string): string {
  return safeBaseName(originalName);
}

/**
 * Tente de traiter l'image avec sharp (resize + conversion JPEG).
 * Si sharp n'est pas disponible (binaire natif absent), renvoie le buffer brut
 * avec le type MIME d'origine — Vercel Blob accepte JPEG/PNG/WebP nativement.
 */
async function prepareImageBuffer(file: File): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  if (file.size > MAX_BYTES) throw new Error("FILE_TOO_LARGE");

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("INVALID_TYPE");
  }

  const raw = Buffer.from(await file.arrayBuffer());

  try {
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(raw)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { buffer: jpeg, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    // sharp indisponible (binaire natif manquant sur ce runtime) — fallback raw
    const extMap: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    return { buffer: raw, contentType: mime, ext: extMap[mime] ?? "jpg" };
  }
}

/**
 * Enregistre une image admin (catalogue / boutique).
 * - Prod Vercel : Vercel Blob (BLOB_READ_WRITE_TOKEN) → URL HTTPS publique
 * - Dev local : public/uploads → nom de fichier seul
 */
export async function saveAdminImageFile(file: File): Promise<string> {
  const { buffer, contentType, ext } = await prepareImageBuffer(file);
  const fileName = `${safeBaseName(file.name)}-${randomUUID().slice(0, 8)}.${ext}`;

  if (isBlobStorageReady()) {
    try {
      const blob = await put(`admin/${fileName}`, buffer, {
        access: "public",
        contentType,
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
    await writeFile(path.join(UPLOAD_ROOT, fileName), buffer);
  } catch {
    throw new Error("WRITE_FAILED");
  }

  return fileName;
}
