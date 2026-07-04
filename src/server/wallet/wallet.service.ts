import "server-only";
import { prisma } from "@/lib/prisma";
import { roundEur } from "@/lib/wallet";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";

export interface WalletSummary {
  depositBalanceEur: number;
  earnedBalanceEur: number;
  spendableBalanceEur: number;
  recentEntries: {
    id: string;
    type: string;
    amountEur: number;
    feeEur: number;
    balanceAfterEur: number;
    note: string | null;
    createdAt: Date;
  }[];
}

function totalBalance(deposit: number, earned: number): number {
  return roundEur(deposit + earned);
}

export async function ensureWalletAccount(userId: string) {
  return prisma.walletAccount.upsert({
    where: { userId },
    create: { userId, depositBalance: 0, earnedBalance: 0 },
    update: {},
  });
}

/** Solde utilisable pour acheter (dépôts + gains). */
export async function getWalletSpendableBalanceEur(userId: string): Promise<number> {
  const account = await ensureWalletAccount(userId);
  return totalBalance(Number(account.depositBalance), Number(account.earnedBalance));
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const account = await prisma.walletAccount.findUnique({
    where: { userId },
    include: {
      entries: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!account) {
    return { depositBalanceEur: 0, earnedBalanceEur: 0, spendableBalanceEur: 0, recentEntries: [] };
  }

  const depositBalanceEur = Number(account.depositBalance);
  const earnedBalanceEur = Number(account.earnedBalance);

  return {
    depositBalanceEur,
    earnedBalanceEur,
    spendableBalanceEur: totalBalance(depositBalanceEur, earnedBalanceEur),
    recentEntries: account.entries.map((e) => ({
      id: e.id,
      type: e.type,
      amountEur: Number(e.amount),
      feeEur: Number(e.feeAmount),
      balanceAfterEur: Number(e.balanceAfter),
      note: e.note,
      createdAt: e.createdAt,
    })),
  };
}

/** Crédite le portefeuille après un dépôt Stripe (idempotent par session). */
export async function creditWalletFromTopUp(input: {
  userId: string;
  creditEur: number;
  feeEur: number;
  stripeCheckoutSessionId: string;
}): Promise<void> {
  const existing = await prisma.walletLedgerEntry.findUnique({
    where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, depositBalance: 0, earnedBalance: 0 },
      update: {},
    });

    const credit = roundEur(input.creditEur);
    const depositAfter = roundEur(Number(account.depositBalance) + credit);
    const earnedAfter = roundEur(Number(account.earnedBalance));

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { depositBalance: depositAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "TOP_UP",
        amount: credit,
        feeAmount: roundEur(input.feeEur),
        balanceAfter: totalBalance(depositAfter, earnedAfter),
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        note: "wallet.topUpNote",
      },
    });
  });

  await evaluateUserBadgesSafe(input.userId);
}

/** Crédite un bonus promotionnel (parrainage) sur le solde dépôt (non retirable). */
export async function creditWalletReferralBonus(input: {
  userId: string;
  creditEur: number;
  note: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, depositBalance: 0, earnedBalance: 0 },
      update: {},
    });

    const credit = roundEur(input.creditEur);
    const depositAfter = roundEur(Number(account.depositBalance) + credit);
    const earnedAfter = roundEur(Number(account.earnedBalance));

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { depositBalance: depositAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "REFERRAL_BONUS",
        amount: credit,
        balanceAfter: totalBalance(depositAfter, earnedAfter),
        note: input.note,
      },
    });
  });
}

/**
 * Débite le portefeuille pour une vente marketplace.
 * Priorité : crédits déposés, puis gains vendeur si besoin.
 */
export async function debitWalletForSale(input: {
  userId: string;
  saleId: string;
  amountEur: number;
}): Promise<void> {
  const amount = roundEur(input.amountEur);
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  const existing = await prisma.walletLedgerEntry.findFirst({
    where: { saleId: input.saleId, type: "PURCHASE" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.findUnique({ where: { userId: input.userId } });
    if (!account) throw new Error("INSUFFICIENT_CREDIT");

    const deposit = Number(account.depositBalance);
    const earned = Number(account.earnedBalance);
    if (deposit + earned < amount) throw new Error("INSUFFICIENT_CREDIT");

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
        type: "PURCHASE",
        amount: -amount,
        feeAmount: 0,
        balanceAfter: totalBalance(depositAfter, earnedAfter),
        saleId: input.saleId,
        note: "wallet.purchaseNote",
      },
    });
  });
}

/** Rembourse l'acheteur en crédits dépôt (annulation / litige). Idempotent par vente. */
export async function creditWalletForSaleRefund(input: {
  userId: string;
  saleId: string;
  amountEur: number;
}): Promise<void> {
  const amount = roundEur(input.amountEur);
  if (amount <= 0) return;

  const existing = await prisma.walletLedgerEntry.findFirst({
    where: { saleId: input.saleId, type: "REFUND" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, depositBalance: 0, earnedBalance: 0 },
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
        type: "REFUND",
        amount,
        feeAmount: 0,
        balanceAfter: totalBalance(depositAfter, earnedAfter),
        saleId: input.saleId,
        note: "wallet.refundNote",
      },
    });
  });
}

/** Crédite les gains vendeur (retirables). Idempotent par vente. */
export async function creditWalletForSalePayout(input: {
  userId: string;
  saleId: string;
  amountEur: number;
}): Promise<void> {
  const amount = roundEur(input.amountEur);
  if (amount <= 0) return;

  const existing = await prisma.walletLedgerEntry.findFirst({
    where: { saleId: input.saleId, type: "SALE_PAYOUT" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, depositBalance: 0, earnedBalance: 0 },
      update: {},
    });

    const depositAfter = roundEur(Number(account.depositBalance));
    const earnedAfter = roundEur(Number(account.earnedBalance) + amount);

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { earnedBalance: earnedAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "SALE_PAYOUT",
        amount,
        feeAmount: 0,
        balanceAfter: totalBalance(depositAfter, earnedAfter),
        saleId: input.saleId,
        note: "wallet.salePayoutNote",
      },
    });
  });
}

/** Vérifie si une vente a été payée via le portefeuille interne (pas de PI Stripe). */
export async function isWalletFundedSale(saleId: string): Promise<boolean> {
  const entry = await prisma.walletLedgerEntry.findFirst({
    where: { saleId, type: "PURCHASE" },
    select: { id: true },
  });
  return Boolean(entry);
}

/** Débite les gains vendeur après virement Stripe Connect. Idempotent par transfer. */
export async function debitWalletForWithdrawal(input: {
  userId: string;
  amountEur: number;
  stripeTransferId: string;
}): Promise<void> {
  const amount = roundEur(input.amountEur);
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  const existing = await prisma.walletLedgerEntry.findUnique({
    where: { stripeTransferId: input.stripeTransferId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.findUnique({ where: { userId: input.userId } });
    if (!account) throw new Error("INSUFFICIENT_EARNED");

    const earned = Number(account.earnedBalance);
    if (earned < amount) throw new Error("INSUFFICIENT_EARNED");

    const depositAfter = roundEur(Number(account.depositBalance));
    const earnedAfter = roundEur(earned - amount);

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { earnedBalance: earnedAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "WITHDRAWAL",
        amount: -amount,
        feeAmount: 0,
        balanceAfter: totalBalance(depositAfter, earnedAfter),
        stripeTransferId: input.stripeTransferId,
        note: "wallet.withdrawNote",
      },
    });
  });
}
