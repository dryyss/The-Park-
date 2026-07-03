/**
 * Env des tests d'intégration.
 * SÉCURITÉ : on n'utilise JAMAIS le DATABASE_URL du .env (base Neon partagée).
 * Les tests tournent contre une base Postgres jetable (conteneur Docker local) :
 *   docker run -d --name thepark-qa-pg -e POSTGRES_PASSWORD=qa -e POSTGRES_DB=thepark_qa -p 55432:5432 postgres:17-alpine
 *   DATABASE_URL="postgresql://postgres:qa@localhost:55432/thepark_qa" pnpm prisma db push
 */
const QA_DATABASE_URL =
  process.env.QA_DATABASE_URL ?? "postgresql://postgres:qa@localhost:55432/thepark_qa";

if (!/localhost|127\.0\.0\.1/.test(QA_DATABASE_URL)) {
  throw new Error("Refus : les tests d'intégration n'acceptent qu'une base locale (localhost).");
}
process.env.DATABASE_URL = QA_DATABASE_URL;

// Neutralise les services externes : les services basculent sur leurs chemins
// simulés (isStripeConfigured() === false, etc.). Aucun appel réseau sortant.
delete process.env.STRIPE_SECRET_KEY;
delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.RESEND_API_KEY;
delete process.env.PUSHER_APP_ID;
delete process.env.PUSHER_KEY;
delete process.env.PUSHER_SECRET;
delete process.env.PUSHER_CLUSTER;
delete process.env.BLOB_READ_WRITE_TOKEN;
