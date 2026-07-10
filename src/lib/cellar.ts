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

/**
 * Config lue **paresseusement** (à chaque appel), pas au chargement du module.
 * Sinon les valeurs seraient figées à l'import : éditer `.env` pendant que le
 * serveur dev tourne n'aurait aucun effet, et un ordre de chargement défavorable
 * capturerait des identifiants vides → échec d'upload silencieux (UPLOAD_FAILED).
 */
function cellarConfig() {
  return {
    host: process.env.CELLAR_ADDON_HOST?.trim(),
    keyId: process.env.CELLAR_ADDON_KEY_ID?.trim(),
    keySecret: process.env.CELLAR_ADDON_KEY_SECRET?.trim(),
    bucket: process.env.CELLAR_BUCKET?.trim(),
    region: process.env.CELLAR_REGION?.trim() || "us-east-1",
  };
}

export function isCellarReady(): boolean {
  const { host, keyId, keySecret, bucket } = cellarConfig();
  return Boolean(host && keyId && keySecret && bucket);
}

function client(): S3Client {
  const { host, keyId, keySecret, region } = cellarConfig();
  if (!(host && keyId && keySecret)) throw new Error("CELLAR_NOT_CONFIGURED");
  // Pas de cache module-level : le client suit la config courante (creds à jour).
  return new S3Client({
    endpoint: `https://${host}`,
    region,
    credentials: { accessKeyId: keyId, secretAccessKey: keySecret },
    // URL virtual-hosted : https://<bucket>.<host>/<key>
    forcePathStyle: false,
  });
}

/** URL publique d'un objet (bucket en public-read). */
export function cellarPublicUrl(key: string): string {
  const { host, bucket } = cellarConfig();
  return `https://${bucket}.${host}/${key}`;
}

/** Vrai si l'URL pointe vers notre bucket Cellar. */
export function isCellarUrl(url: string): boolean {
  const { host, bucket } = cellarConfig();
  return isCellarReady() && url.startsWith(`https://${bucket}.${host}/`);
}

/** Extrait la clé objet d'une URL Cellar (ou null si ce n'en est pas une). */
export function cellarKeyFromUrl(url: string): string | null {
  const { host, bucket } = cellarConfig();
  const prefix = `https://${bucket}.${host}/`;
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
      Bucket: cellarConfig().bucket,
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
    await client().send(new DeleteObjectCommand({ Bucket: cellarConfig().bucket, Key: key }));
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
    Bucket: cellarConfig().bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client(), command, {
    expiresIn: expiresInSeconds,
  });
  return { uploadUrl, publicUrl: cellarPublicUrl(key) };
}
