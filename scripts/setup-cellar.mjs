/**
 * Crée le bucket Cellar (Clever Cloud, compatible S3) + applique une policy
 * public-read, pour que les uploads d'images (admin catalogue/boutique et photos
 * de cartes des membres) fonctionnent et soient servis publiquement.
 *
 * Prérequis : les variables Cellar dans .env (déjà présentes) —
 *   CELLAR_ADDON_HOST, CELLAR_ADDON_KEY_ID, CELLAR_ADDON_KEY_SECRET, CELLAR_BUCKET
 *
 * Usage : node scripts/setup-cellar.mjs
 *
 * Le bucket est créé sur l'addon Cellar de prod (les clés .env pointent dessus).
 * Idempotent : relançable sans risque.
 */
import "dotenv/config";
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

const HOST = process.env.CELLAR_ADDON_HOST?.trim();
const KEY_ID = process.env.CELLAR_ADDON_KEY_ID?.trim();
const KEY_SECRET = process.env.CELLAR_ADDON_KEY_SECRET?.trim();
const BUCKET = process.env.CELLAR_BUCKET?.trim();

if (!HOST || !KEY_ID || !KEY_SECRET || !BUCKET) {
  console.error(
    "❌ Variables manquantes. Requis dans .env : CELLAR_ADDON_HOST, CELLAR_ADDON_KEY_ID, CELLAR_ADDON_KEY_SECRET, CELLAR_BUCKET",
  );
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: `https://${HOST}`,
  region: "us-east-1",
  credentials: { accessKeyId: KEY_ID, secretAccessKey: KEY_SECRET },
  forcePathStyle: true, // path-style pour les opérations d'administration du bucket
});

async function main() {
  console.log(`→ Cellar : ${HOST}`);
  console.log(`→ Bucket : ${BUCKET}\n`);

  // 1) Créer le bucket (idempotent)
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`✓ Bucket « ${BUCKET} » créé`);
  } catch (err) {
    const name = err?.name ?? "";
    if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") {
      console.log(`• Bucket « ${BUCKET} » déjà présent — ok`);
    } else {
      throw err;
    }
  }

  // 2) Policy public-read (lecture des objets par tous → images affichables)
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicRead",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${BUCKET}/*`,
      },
    ],
  };
  await s3.send(
    new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }),
  );
  console.log("✓ Policy public-read appliquée");

  console.log(
    `\n✅ Cellar prêt. Les images seront servies sur : https://${BUCKET}.${HOST}/<clé>`,
  );
  console.log(
    "→ Vérifie que CELLAR_BUCKET=" +
      BUCKET +
      " est bien dans les variables Clever, puis redéploie.",
  );
}

main().catch((e) => {
  console.error("\n❌ Échec :", e?.message ?? e);
  process.exit(1);
});
