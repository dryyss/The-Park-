-- Panier marketplace : réservation d'annonce + notification vendeur

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LISTING_IN_CART';

CREATE TABLE "MarketplaceCartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceCartItem_listingId_key" ON "MarketplaceCartItem"("listingId");
CREATE UNIQUE INDEX "MarketplaceCartItem_userId_listingId_key" ON "MarketplaceCartItem"("userId", "listingId");
CREATE INDEX "MarketplaceCartItem_userId_idx" ON "MarketplaceCartItem"("userId");

ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
