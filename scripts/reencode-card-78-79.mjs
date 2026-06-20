/**
 * Ré-encode les JPEG catalogue 78-79 pour compatibilité affichage (sans mozjpeg/progressive).
 * Usage : npx tsx scripts/reencode-card-78-79.mjs
 */
import sharp from "sharp";
import path from "node:path";

const FILES = [
  "78_TOYOTA_COROLLA_AE86_LEVIN_POCKET_DRIFTER.jpg",
  "79_MAZDA_SAVANNA_RX7_FB_UNIQUE.jpg",
];

const UPLOADS = path.join(process.cwd(), "public/uploads");

for (const file of FILES) {
  const full = path.join(UPLOADS, file);
  const tmp = `${full}.tmp`;
  await sharp(full)
    .jpeg({ quality: 85, progressive: false, mozjpeg: false })
    .toFile(tmp);
  const { rename, unlink } = await import("node:fs/promises");
  await unlink(full).catch(() => undefined);
  await rename(tmp, full);
  const meta = await sharp(full).metadata();
  console.log(`✓ ${file} → ${meta.width}x${meta.height} progressive=${meta.isProgressive}`);
}
