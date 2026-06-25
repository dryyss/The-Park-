import "server-only";
import { prisma } from "@/lib/prisma";
import { roundEur } from "@/lib/wallet";

/** Montant de la caution par partie pour un échange sécurisé (5 €). */
export const EXCHANGE_CAUTION_EUR = 5;

/**
 * Bloque la caution des deux parties en portefeuille.
 * Appelé quand les deux parties valident et passent en AWAITING_SHIPMENT.
 * Idempotent par échange.
 */
export async function lockExchangeCautions(exchangeId: string): Promise<void> {
  const exchange = await prisma.exchange.findUnique({
    where: { id: exchangeId },
    select: { id: true, secured: true, initiatorId: true, recipientId: true },
  });
  if (!exchange || !exchange.secured) return;

  // Idempotency : cautions déjà créées ?
  const existing = await prisma.payment.count({
    where: { exchangeId, kind: "CAUTION" },
  });
  if (existing > 0) return;

  const amount = roundEur(EXCHANGE_CAUTION_EUR);
  const parties = [exchange.initiatorId, exchange.recipientId];

  // Vérifie que les deux parties ont assez de solde avant de débiter quoi que ce soit.
  for (const userId of parties) {
    const account = await prisma.walletAccount.findUnique({ where: { userId } });
    const balance = account
      ? roundEur(Number(account.depositBalance) + Number(account.earnedBalance))
      : 0;
    if (balance < amount) throw new Error(`INSUFFICIENT_CAUTION:${userId}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const userId of parties) {
      const account = await tx.walletAccount.findUnique({ where: { userId } });
      if (!account) throw new Error("WALLET_NOT_FOUND");

      const deposit = Number(account.depositBalance);
      const earned = Number(account.earnedBalance);
      const fromDeposit = roundEur(Math.min(deposit, amount));
      const fromEarned = roundEur(amount - fromDeposit);
      const depositAfter = roundEur(deposit - fromDeposit);
      const earnedAfter = roundEur(earned - fromEarned);

      await tx.walletAccount.update({
        where: { id: account.id },
        data: { depositBalance: depositAfter, earnedBalance: earnedAfter },
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletAccountId: account.id,
          type: "CAUTION_LOCK",
          amount: -amount,
          feeAmount: 0,
          balanceAfter: roundEur(depositAfter + earnedAfter),
          exchangeId,
          note: "wallet.cautionLockNote",
        },
      });

      await tx.payment.create({
        data: {
          userId,
          kind: "CAUTION",
          status: "AUTHORIZED",
          amount,
          exchangeId,
        },
      });
    }

    await tx.transactionEvent.create({
      data: {
        entityType: "EXCHANGE",
        entityId: exchangeId,
        event: "CAUTIONS_LOCKED",
        metadata: { amountEur: amount, parties },
      },
    });
  });
}

/**
 * Restitue les cautions aux deux parties (échange complété ou annulé).
 * `reason`: "COMPLETED" → libération normale, "CANCELLED" → remboursement.
 * Idempotent.
 */
export async function releaseExchangeCautions(
  exchangeId: string,
  reason: "COMPLETED" | "CANCELLED",
): Promise<void> {
  const cautions = await prisma.payment.findMany({
    where: { exchangeId, kind: "CAUTION", status: "AUTHORIZED" },
    select: { id: true, userId: true, amount: true },
  });
  if (cautions.length === 0) return;

  const entryType = "CAUTION_RELEASE";

  await prisma.$transaction(async (tx) => {
    for (const caution of cautions) {
      const amount = roundEur(Number(caution.amount));

      const account = await tx.walletAccount.upsert({
        where: { userId: caution.userId },
        create: { userId: caution.userId, depositBalance: 0, earnedBalance: 0 },
        update: {},
      });

      const depositAfter = roundEur(Number(account.depositBalance) + amount);
      const earnedAfter = roundEur(Number(account.earnedBalance));

      await tx.walletAccount.update({
        where: { id: account.id },
        data: { depositBalance: depositAfter },
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletAccountId: account.id,
          type: entryType,
          amount,
          feeAmount: 0,
          balanceAfter: roundEur(depositAfter + earnedAfter),
          exchangeId,
          note:
            reason === "COMPLETED"
              ? "wallet.cautionReleaseNote"
              : "wallet.cautionRefundNote",
        },
      });

      await tx.payment.update({
        where: { id: caution.id },
        data: { status: reason === "COMPLETED" ? "RELEASED" : "REFUNDED", releasedAt: new Date() },
      });
    }

    await tx.transactionEvent.create({
      data: {
        entityType: "EXCHANGE",
        entityId: exchangeId,
        event: reason === "COMPLETED" ? "CAUTIONS_RELEASED" : "CAUTIONS_REFUNDED",
      },
    });
  });
}
