-- AlterTable: add shippingAddressId to MarketplaceCheckout (idempotent)
ALTER TABLE "MarketplaceCheckout" ADD COLUMN IF NOT EXISTS "shippingAddressId" TEXT;

-- AddForeignKey (idempotent : Postgres n'a pas "ADD CONSTRAINT IF NOT EXISTS")
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MarketplaceCheckout_shippingAddressId_fkey'
  ) THEN
    ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_shippingAddressId_fkey"
      FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "MarketplaceCheckout_shippingAddressId_idx" ON "MarketplaceCheckout"("shippingAddressId");
