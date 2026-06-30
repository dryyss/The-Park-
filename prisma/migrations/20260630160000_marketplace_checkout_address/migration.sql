-- AlterTable: add shippingAddressId to MarketplaceCheckout
ALTER TABLE "MarketplaceCheckout" ADD COLUMN "shippingAddressId" TEXT;

-- AddForeignKey
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_shippingAddressId_fkey"
  FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MarketplaceCheckout_shippingAddressId_idx" ON "MarketplaceCheckout"("shippingAddressId");
