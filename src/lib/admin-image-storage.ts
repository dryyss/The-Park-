import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 5 * 1024 * 1024;
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

/** Enregistre une image admin (catalogue / boutique) dans public/uploads. Retourne le nom de fichier seul. */
export async function saveAdminImageFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("INVALID_TYPE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOAD_ROOT, { recursive: true });

  const fileName = `${safeBaseName(file.name)}-${randomUUID().slice(0, 8)}.jpg`;
  const outPath = path.join(UPLOAD_ROOT, fileName);

  const sharp = (await import("sharp")).default;
  await sharp(buffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);

  return fileName;
}
