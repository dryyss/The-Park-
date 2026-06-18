-- Split single wallet balance into deposit (non-withdrawable) and earned (withdrawable).
ALTER TABLE "WalletAccount" ADD COLUMN "depositBalance" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "WalletAccount" ADD COLUMN "earnedBalance" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Recompute from ledger history.
UPDATE "WalletAccount" wa
SET
  "depositBalance" = COALESCE(agg.deposit, 0),
  "earnedBalance" = COALESCE(agg.earned, 0)
FROM (
  SELECT
    e."walletAccountId",
    SUM(
      CASE
        WHEN e.type IN ('TOP_UP', 'REFUND', 'PURCHASE', 'ADJUSTMENT') THEN e.amount
        ELSE 0
      END
    ) AS deposit,
    SUM(
      CASE
        WHEN e.type = 'SALE_PAYOUT' THEN e.amount
        ELSE 0
      END
    ) AS earned
  FROM "WalletLedgerEntry" e
  GROUP BY e."walletAccountId"
) agg
WHERE wa.id = agg."walletAccountId";

-- Accounts without ledger entries keep legacy balance as deposit.
UPDATE "WalletAccount"
SET "depositBalance" = "balance"
WHERE "depositBalance" = 0 AND "earnedBalance" = 0 AND "balance" <> 0;

ALTER TABLE "WalletAccount" DROP COLUMN "balance";
