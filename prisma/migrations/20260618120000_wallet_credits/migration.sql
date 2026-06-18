-- Portefeuille crédits : dépôts Stripe convertis en solde interne.

CREATE TYPE "WalletEntryType" AS ENUM ('TOP_UP', 'PURCHASE', 'REFUND', 'ADJUSTMENT');

ALTER TYPE "PaymentKind" ADD VALUE 'WALLET_TOP_UP';

CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletAccountId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "feeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "saleId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletAccount_userId_key" ON "WalletAccount"("userId");
CREATE UNIQUE INDEX "WalletLedgerEntry_stripeCheckoutSessionId_key" ON "WalletLedgerEntry"("stripeCheckoutSessionId");
CREATE INDEX "WalletLedgerEntry_walletAccountId_createdAt_idx" ON "WalletLedgerEntry"("walletAccountId", "createdAt");

ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
