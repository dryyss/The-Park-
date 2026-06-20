-- Checkout marketplace groupé + factures acheteur/vendeurs

CREATE TYPE "MarketplaceCheckoutStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'FAILED');
CREATE TYPE "MarketplaceInvoiceRecipient" AS ENUM ('BUYER', 'SELLER');

CREATE TABLE "MarketplaceCheckout" (
    "id" TEXT NOT NULL,
    "checkoutNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" "MarketplaceCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCheckout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceCheckoutLine" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "cartItemId" TEXT,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MarketplaceCheckoutLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceInvoice" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "recipient" "MarketplaceInvoiceRecipient" NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "lineItems" JSONB NOT NULL,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceCheckout_checkoutNumber_key" ON "MarketplaceCheckout"("checkoutNumber");
CREATE UNIQUE INDEX "MarketplaceCheckout_stripeCheckoutSessionId_key" ON "MarketplaceCheckout"("stripeCheckoutSessionId");
CREATE INDEX "MarketplaceCheckout_buyerId_idx" ON "MarketplaceCheckout"("buyerId");
CREATE INDEX "MarketplaceCheckout_status_idx" ON "MarketplaceCheckout"("status");

CREATE UNIQUE INDEX "MarketplaceCheckoutLine_saleId_key" ON "MarketplaceCheckoutLine"("saleId");
CREATE INDEX "MarketplaceCheckoutLine_checkoutId_idx" ON "MarketplaceCheckoutLine"("checkoutId");
CREATE INDEX "MarketplaceCheckoutLine_sellerId_idx" ON "MarketplaceCheckoutLine"("sellerId");

CREATE UNIQUE INDEX "MarketplaceInvoice_invoiceNumber_key" ON "MarketplaceInvoice"("invoiceNumber");
CREATE INDEX "MarketplaceInvoice_checkoutId_idx" ON "MarketplaceInvoice"("checkoutId");
CREATE INDEX "MarketplaceInvoice_userId_idx" ON "MarketplaceInvoice"("userId");

ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutLine" ADD CONSTRAINT "MarketplaceCheckoutLine_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutLine" ADD CONSTRAINT "MarketplaceCheckoutLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceInvoice" ADD CONSTRAINT "MarketplaceInvoice_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceInvoice" ADD CONSTRAINT "MarketplaceInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
