import "server-only";
import { prisma } from "@/lib/prisma";
import type { PaymentKind, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { roundEur } from "@/lib/wallet";
import { formatPrice } from "@/lib/format";

export interface AdminPaymentRow {
  id: string;
  kind: PaymentKind;
  status: PaymentStatus;
  amount: string;
  userName: string | null;
  stripePaymentIntentId: string | null;
  createdAt: Date;
}

export interface AdminWalletRow {
  userId: string;
  displayName: string;
  email: string;
  depositBalance: string;
  earnedBalance: string;
  totalBalance: string;
  entryCount: number;
}

export async function listAdminPayments(input: {
  status?: PaymentStatus;
  kind?: PaymentKind;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminPaymentRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));
  const where: Prisma.PaymentWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.kind) where.kind = input.kind;

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { displayName: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    rows: rows.map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      amount: formatPrice(Number(p.amount)),
      userName: p.user?.displayName ?? null,
      stripePaymentIntentId: p.stripePaymentIntentId,
      createdAt: p.createdAt,
    })),
  };
}

export async function listAdminWallets(input: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminWalletRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));

  const where: Prisma.WalletAccountWhereInput = input.q?.trim()
    ? {
        user: {
          OR: [
            { displayName: { contains: input.q.trim(), mode: "insensitive" } },
            { email: { contains: input.q.trim(), mode: "insensitive" } },
          ],
        },
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.walletAccount.count({ where }),
    prisma.walletAccount.findMany({
      where,
      orderBy: [{ earnedBalance: "desc" }, { depositBalance: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { displayName: true, email: true } },
        _count: { select: { entries: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    rows: rows.map((w) => {
      const deposit = Number(w.depositBalance);
      const earned = Number(w.earnedBalance);
      const totalBal = roundEur(deposit + earned);
      return {
        userId: w.userId,
        displayName: w.user.displayName,
        email: w.user.email,
        depositBalance: formatPrice(deposit),
        earnedBalance: formatPrice(earned),
        totalBalance: formatPrice(totalBal),
        entryCount: w._count.entries,
      };
    }),
  };
}

export async function adminAdjustWallet(input: {
  moderatorId: string;
  userId: string;
  amountEur: number;
  target: "deposit" | "earned";
  note: string;
}): Promise<void> {
  const amount = roundEur(input.amountEur);
  if (amount === 0) throw new Error("INVALID_AMOUNT");

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, depositBalance: 0, earnedBalance: 0 },
      update: {},
    });

    const deposit = Number(account.depositBalance);
    const earned = Number(account.earnedBalance);

    let depositAfter = deposit;
    let earnedAfter = earned;

    if (input.target === "deposit") {
      depositAfter = roundEur(deposit + amount);
      if (depositAfter < 0) throw new Error("INSUFFICIENT_BALANCE");
    } else {
      earnedAfter = roundEur(earned + amount);
      if (earnedAfter < 0) throw new Error("INSUFFICIENT_BALANCE");
    }

    await tx.walletAccount.update({
      where: { id: account.id },
      data: {
        depositBalance: depositAfter,
        earnedBalance: earnedAfter,
      },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "ADJUSTMENT",
        amount,
        feeAmount: 0,
        balanceAfter: roundEur(depositAfter + earnedAfter),
        note: input.note,
      },
    });

    await tx.moderationAction.create({
      data: {
        moderatorId: input.moderatorId,
        action: "WALLET_ADJUSTED",
        targetType: "USER",
        targetId: input.userId,
        details: { amount, target: input.target, note: input.note },
      },
    });
  });
}

export async function getFinanceAdminStats() {
  const [paymentsPending, paymentsCaptured, wallets, totalDeposit, totalEarned] = await Promise.all([
    prisma.payment.count({ where: { status: { in: ["REQUIRES_PAYMENT", "AUTHORIZED"] } } }),
    prisma.payment.count({ where: { status: "CAPTURED" } }),
    prisma.walletAccount.count(),
    prisma.walletAccount.aggregate({ _sum: { depositBalance: true } }),
    prisma.walletAccount.aggregate({ _sum: { earnedBalance: true } }),
  ]);

  return {
    paymentsPending,
    paymentsCaptured,
    wallets,
    totalDepositEur: Number(totalDeposit._sum.depositBalance ?? 0),
    totalEarnedEur: Number(totalEarned._sum.earnedBalance ?? 0),
  };
}
