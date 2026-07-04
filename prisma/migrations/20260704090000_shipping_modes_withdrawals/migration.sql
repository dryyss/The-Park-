-- Modes d'envoi C2C (choix acheteur au checkout).
ALTER TYPE "ShippingMode" ADD VALUE IF NOT EXISTS 'LETTER_TRACKED';
ALTER TYPE "ShippingMode" ADD VALUE IF NOT EXISTS 'COLISSIMO';
ALTER TYPE "ShippingMode" ADD VALUE IF NOT EXISTS 'PICKUP_POINT';
ALTER TYPE "ShippingMode" ADD VALUE IF NOT EXISTS 'HAND_DELIVERY';

-- Snapshot de l'adresse de livraison sur la vente.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "deliveryAddress" JSONB;

-- Retraits des gains vendeur.
DO $$ BEGIN
  CREATE TYPE "WithdrawalMethod" AS ENUM ('BANK_TRANSFER', 'PAYPAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "WithdrawalMethod" NOT NULL,
    "details" JSONB NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "ledgerEntryId" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WithdrawalRequest_userId_idx" ON "WithdrawalRequest"("userId");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");

DO $$ BEGIN
  ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
