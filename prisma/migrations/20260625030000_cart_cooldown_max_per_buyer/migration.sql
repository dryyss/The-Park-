-- CreateTable: cooldown panier 10 min après expiration
CREATE TABLE "MarketplaceCartCooldown" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "cooldownUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceCartCooldown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceCartCooldown_userId_listingId_key" ON "MarketplaceCartCooldown"("userId", "listingId");
CREATE INDEX "MarketplaceCartCooldown_cooldownUntil_idx" ON "MarketplaceCartCooldown"("cooldownUntil");

-- AlterTable: limite d'achat par acheteur sur une annonce
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "maxPerBuyer" INTEGER;
