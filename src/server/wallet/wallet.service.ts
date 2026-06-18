import "server-only";
import { prisma } from "@/lib/prisma";
import { roundEur } from "@/lib/wallet";

export interface WalletSummary {
  balanceEur: number;
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

export async function ensureWalletAccount(userId: string) {
  return prisma.walletAccount.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

export async function getWalletBalanceEur(userId: string): Promise<number> {
  const account = await ensureWalletAccount(userId);
  return Number(account.balance);
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const account = await prisma.walletAccount.findUnique({
    where: { userId },
    include: {
      entries: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!account) {
    return { balanceEur: 0, recentEntries: [] };
  }

  return {
    balanceEur: Number(account.balance),
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
      create: { userId: input.userId, balance: 0 },
      update: {},
    });

    const credit = roundEur(input.creditEur);
    const balanceAfter = roundEur(Number(account.balance) + credit);

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "TOP_UP",
        amount: credit,
        feeAmount: roundEur(input.feeEur),
        balanceAfter,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        note: "wallet.topUpNote",
      },
    });
  });
}

/** Débite le portefeuille pour une vente marketplace. */
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

    const balance = Number(account.balance);
    if (balance < amount) throw new Error("INSUFFICIENT_CREDIT");

    const balanceAfter = roundEur(balance - amount);

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "PURCHASE",
        amount: -amount,
        feeAmount: 0,
        balanceAfter,
        saleId: input.saleId,
        note: "wallet.purchaseNote",
      },
    });
  });
}

/** Rembourse l'acheteur sur son portefeuille (annulation / litige). Idempotent par vente. */
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
      create: { userId: input.userId, balance: 0 },
      update: {},
    });

    const balanceAfter = roundEur(Number(account.balance) + amount);

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "REFUND",
        amount,
        feeAmount: 0,
        balanceAfter,
        saleId: input.saleId,
        note: "wallet.refundNote",
      },
    });
  });
}

/** Crédite le vendeur à la clôture d'une vente payée via portefeuille. Idempotent par vente. */
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
      create: { userId: input.userId, balance: 0 },
      update: {},
    });

    const balanceAfter = roundEur(Number(account.balance) + amount);

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "SALE_PAYOUT",
        amount,
        feeAmount: 0,
        balanceAfter,
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
