import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Stockage objet Cellar (Clever Cloud, compatible S3).
 *
 * Clever injecte automatiquement `CELLAR_ADDON_HOST`, `CELLAR_ADDON_KEY_ID` et
 * `CELLAR_ADDON_KEY_SECRET` quand l'addon Cellar est lié à l'application.
 * Le nom du bucket est choisi par nous (`CELLAR_BUCKET`).
 *
 * ⚠️ Le bucket doit avoir une policy **public-read** (voir docs/DEPLOIEMENT-PROD.md)
 * pour que les URLs renvoyées soient accessibles publiquement.
 */

const HOST = process.env.CELLAR_ADDON_HOST?.trim();
const KEY_ID = process.env.CELLAR_ADDON_KEY_ID?.trim();
const KEY_SECRET = process.env.CELLAR_ADDON_KEY_SECRET?.trim();
const BUCKET = process.env.CELLAR_BUCKET?.trim();
const REGION = process.env.CELLAR_REGION?.trim() || "us-east-1";

export function isCellarReady(): boolean {
  return Boolean(HOST && KEY_ID && KEY_SECRET && BUCKET);
}

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (!isCellarReady()) throw new Error("CELLAR_NOT_CONFIGURED");
  if (!cachedClient) {
    cachedClient = new S3Client({
      endpoint: `https://${HOST}`,
      region: REGION,
      credentials: { accessKeyId: KEY_ID!, secretAccessKey: KEY_SECRET! },
      // URL virtual-hosted : https://<bucket>.<host>/<key>
      forcePathStyle: false,
    });
  }
  return cachedClient;
}

/** URL publique d'un objet (bucket en public-read). */
export function cellarPublicUrl(key: string): string {
  return `https://${BUCKET}.${HOST}/${key}`;
}

/** Vrai si l'URL pointe vers notre bucket Cellar. */
export function isCellarUrl(url: string): boolean {
  return isCellarReady() && url.startsWith(`https://${BUCKET}.${HOST}/`);
}

/** Extrait la clé objet d'une URL Cellar (ou null si ce n'en est pas une). */
export function cellarKeyFromUrl(url: string): string | null {
  const prefix = `https://${BUCKET}.${HOST}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** Enregistre un buffer côté serveur et renvoie l'URL publique. */
export async function cellarPut(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return cellarPublicUrl(key);
}

/** Supprime un objet (best-effort). */
export async function cellarDelete(url: string): Promise<void> {
  const key = cellarKeyFromUrl(url);
  if (!key) return;
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // best-effort : objet déjà absent ou erreur réseau transitoire
  }
}

/**
 * Génère une URL présignée PUT pour un upload direct navigateur → Cellar
 * (utilisé pour les grosses vidéos de preuve C2C, qui ne peuvent pas transiter
 * par le corps de la requête serveur).
 */
export async function cellarPresignPut(
  key: string,
  contentType: string,
  expiresInSeconds = 600,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client(), command, {
    expiresIn: expiresInSeconds,
  });
  return { uploadUrl, publicUrl: cellarPublicUrl(key) };
}
