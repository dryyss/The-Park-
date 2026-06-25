-- AlterTable: add expiresAt to MarketplaceCartItem (30-min reservation window)
ALTER TABLE "MarketplaceCartItem" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Backfill existing rows: treat legacy items as expired immediately
UPDATE "MarketplaceCartItem" SET "expiresAt" = NOW() WHERE "expiresAt" IS NULL;

-- Make column NOT NULL now that all rows have a value
ALTER TABLE "MarketplaceCartItem" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketplaceCartItem_expiresAt_idx" ON "MarketplaceCartItem"("expiresAt");
