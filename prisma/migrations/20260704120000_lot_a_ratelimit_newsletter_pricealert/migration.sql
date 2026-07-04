-- Lot A : rate limiting (LCEN/sécurité), newsletter double opt-in, alertes prix wishlist,
--         idempotence des webhooks Stripe.

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');

-- AlterEnum: alerte prix wishlist
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WISHLIST_PRICE_DROP';

-- AlterTable: seuil d'alerte prix sur la wishlist
ALTER TABLE "WishlistItem" ADD COLUMN "alertPrice" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WishlistItem_cardId_idx" ON "WishlistItem"("cardId");

-- CreateTable: compteur de rate-limiting (fenêtre fixe, partagé multi-instances)
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RateLimitHit_key_windowStart_key" ON "RateLimitHit"("key", "windowStart");
CREATE INDEX "RateLimitHit_windowStart_idx" ON "RateLimitHit"("windowStart");

-- CreateTable: abonnements newsletter (double opt-in RGPD)
CREATE TABLE "NewsletterSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "token" TEXT NOT NULL,
    "source" TEXT DEFAULT 'footer',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NewsletterSubscription_email_key" ON "NewsletterSubscription"("email");
CREATE UNIQUE INDEX "NewsletterSubscription_token_key" ON "NewsletterSubscription"("token");
CREATE INDEX "NewsletterSubscription_status_idx" ON "NewsletterSubscription"("status");

-- CreateTable: idempotence des webhooks (anti-rejeu Stripe)
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");
