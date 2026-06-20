/**
 * Compresse les PNG lourds du catalogue en JPEG (~400 Ko).
 * Usage : node scripts/optimize-card-images.mjs
 */
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const UPLOADS = path.join(process.cwd(), "public/uploads");
const MIN_BYTES = 800_000;

const files = await readdir(UPLOADS);
let converted = 0;

for (const file of files) {
  if (!file.endsWith(".png")) continue;
  const full = path.join(UPLOADS, file);
  const { size } = await stat(full);
  if (size < MIN_BYTES) continue;

  const jpgName = file.replace(/\.png$/i, ".jpg");
  const out = path.join(UPLOADS, jpgName);
  await sharp(full)
    .resize(1200, null, { withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: false, mozjpeg: false })
    .toFile(out);
  console.log(`✓ ${file} (${(size / 1024 / 1024).toFixed(1)} Mo) → ${jpgName}`);
  converted += 1;
}

console.log(converted ? `Terminé : ${converted} fichier(s).` : "Aucun PNG > 800 Ko à convertir.");
