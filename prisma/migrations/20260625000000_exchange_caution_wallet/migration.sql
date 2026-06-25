-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE IF NOT EXISTS 'CAUTION_LOCK';
ALTER TYPE "WalletEntryType" ADD VALUE IF NOT EXISTS 'CAUTION_RELEASE';

-- AlterTable
ALTER TABLE "WalletLedgerEntry" ADD COLUMN IF NOT EXISTS "exchangeId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletLedgerEntry_exchangeId_idx" ON "WalletLedgerEntry"("exchangeId");
