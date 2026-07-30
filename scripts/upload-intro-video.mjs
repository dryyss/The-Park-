/**
 * Envoie une vidéo (ou tout fichier) sur Cellar (Clever Cloud, S3) et affiche
 * l'URL publique à coller dans /admin/reglages (« Vidéo de présentation »).
 *
 * Prérequis : variables Cellar dans .env + bucket public-read (voir
 * scripts/setup-cellar.mjs).
 *
 * Usage :
 *   node scripts/upload-intro-video.mjs "0729 (4)(7).mp4"
 *   node scripts/upload-intro-video.mjs "chemin/video.mp4" platform/intro.mp4
 *
 * Le 2e argument (clé) est optionnel : par défaut platform/intro-<timestamp>.mp4
 */
import "dotenv/config";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const HOST = process.env.CELLAR_ADDON_HOST?.trim();
const KEY_ID = process.env.CELLAR_ADDON_KEY_ID?.trim();
const KEY_SECRET = process.env.CELLAR_ADDON_KEY_SECRET?.trim();
const BUCKET = process.env.CELLAR_BUCKET?.trim();

if (!HOST || !KEY_ID || !KEY_SECRET || !BUCKET) {
  console.error(
    "❌ Variables manquantes dans .env : CELLAR_ADDON_HOST, CELLAR_ADDON_KEY_ID, CELLAR_ADDON_KEY_SECRET, CELLAR_BUCKET",
  );
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Chemin du fichier requis. Ex : node scripts/upload-intro-video.mjs "0729 (4)(7).mp4"');
  process.exit(1);
}

const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};
const ext = path.extname(filePath).toLowerCase();
const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

const key = process.argv[3]?.trim() || `platform/intro-${Date.now()}${ext || ".mp4"}`;

const size = statSync(filePath).size;

const s3 = new S3Client({
  endpoint: `https://${HOST}`,
  region: "us-east-1",
  credentials: { accessKeyId: KEY_ID, secretAccessKey: KEY_SECRET },
  forcePathStyle: false, // virtual-hosted, cohérent avec src/lib/cellar.ts
});

async function main() {
  console.log(`→ Fichier : ${filePath} (${(size / 1024 / 1024).toFixed(1)} Mo, ${contentType})`);
  console.log(`→ Bucket  : ${BUCKET} sur ${HOST}`);
  console.log(`→ Clé     : ${key}\n`);
  console.log("Lecture du fichier en mémoire…");
  const body = readFileSync(filePath);
  console.log("Upload en cours… (peut prendre un moment selon la connexion)");

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentLength: size,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const url = `https://${BUCKET}.${HOST}/${key}`;
  console.log("\n✅ Upload terminé.");
  console.log("\nURL publique à coller dans /admin/reglages → « Vidéo de présentation (URL) » :\n");
  console.log(url);
}

main().catch((e) => {
  console.error("\n❌ Échec :", e?.message ?? e);
  process.exit(1);
});
