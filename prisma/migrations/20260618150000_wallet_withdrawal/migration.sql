-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'WITHDRAWAL';

-- AlterTable
ALTER TABLE "WalletLedgerEntry" ADD COLUMN "stripeTransferId" TEXT;
CREATE UNIQUE INDEX "WalletLedgerEntry_stripeTransferId_key" ON "WalletLedgerEntry"("stripeTransferId");
