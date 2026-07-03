import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  debitWalletForSale,
  creditWalletForSaleRefund,
  creditWalletForSalePayout,
  debitWalletForWithdrawal,
  getWalletSpendableBalanceEur,
} from "@/server/wallet/wallet.service";
import { withdrawEarnedToBank } from "@/server/wallet/wallet-withdraw.service";
import { qaTag, createTestUser, creditTestWallet, cleanupTag } from "../_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

async function walletOf(userId: string) {
  const account = await prisma.walletAccount.findUniqueOrThrow({ where: { userId } });
  return {
    deposit: Number(account.depositBalance),
    earned: Number(account.earnedBalance),
    id: account.id,
  };
}

describe(`wallet [${TAG}] — débits, remboursements, retraits, ledger`, () => {
  it("débite un achat (dépôt d'abord) et journalise balanceAfter", async () => {
    const user = await createTestUser(TAG, 1);
    await creditTestWallet(user.id, 50);

    await debitWalletForSale({ userId: user.id, saleId: `${TAG}-s1`, amountEur: 30 });

    const w = await walletOf(user.id);
    expect(w.deposit).toBe(20);
    expect(w.earned).toBe(0);

    const entry = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { saleId: `${TAG}-s1`, type: "PURCHASE" },
    });
    expect(Number(entry.amount)).toBe(-30);
    expect(Number(entry.balanceAfter)).toBe(20);
  });

  it("est idempotent par vente (2ᵉ débit ignoré)", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    await debitWalletForSale({ userId: user.id, saleId: `${TAG}-s1`, amountEur: 30 });
    const w = await walletOf(user.id);
    expect(w.deposit).toBe(20);
    const entries = await prisma.walletLedgerEntry.count({
      where: { saleId: `${TAG}-s1`, type: "PURCHASE" },
    });
    expect(entries).toBe(1);
  });

  it("rejette INSUFFICIENT_CREDIT (solde insuffisant) sans modifier la base", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    const before = await walletOf(user.id);

    await expect(
      debitWalletForSale({ userId: user.id, saleId: `${TAG}-s2`, amountEur: 999 }),
    ).rejects.toThrow("INSUFFICIENT_CREDIT");

    const after = await walletOf(user.id);
    expect(after).toEqual(before);
    const entries = await prisma.walletLedgerEntry.count({ where: { saleId: `${TAG}-s2` } });
    expect(entries).toBe(0);
  });

  it("rejette INSUFFICIENT_CREDIT quand aucun compte wallet n'existe", async () => {
    const noWallet = await createTestUser(TAG, 2);
    await expect(
      debitWalletForSale({ userId: noWallet.id, saleId: `${TAG}-s3`, amountEur: 1 }),
    ).rejects.toThrow("INSUFFICIENT_CREDIT");
  });

  it("rejette INVALID_AMOUNT pour un montant nul ou négatif", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    await expect(
      debitWalletForSale({ userId: user.id, saleId: `${TAG}-s4`, amountEur: 0 }),
    ).rejects.toThrow("INVALID_AMOUNT");
    await expect(
      debitWalletForSale({ userId: user.id, saleId: `${TAG}-s4`, amountEur: -5 }),
    ).rejects.toThrow("INVALID_AMOUNT");
  });

  it("rembourse l'acheteur en crédits dépôt (idempotent)", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    await creditWalletForSaleRefund({ userId: user.id, saleId: `${TAG}-s1`, amountEur: 30 });
    await creditWalletForSaleRefund({ userId: user.id, saleId: `${TAG}-s1`, amountEur: 30 });

    const w = await walletOf(user.id);
    expect(w.deposit).toBe(50); // 20 + 30 remboursés, une seule fois
    const entries = await prisma.walletLedgerEntry.count({
      where: { saleId: `${TAG}-s1`, type: "REFUND" },
    });
    expect(entries).toBe(1);
  });

  it("crédite les gains vendeur (earned) séparément du dépôt", async () => {
    const seller = await createTestUser(TAG, 3);
    await creditWalletForSalePayout({ userId: seller.id, saleId: `${TAG}-s5`, amountEur: 12.5 });

    const w = await walletOf(seller.id);
    expect(w.deposit).toBe(0);
    expect(w.earned).toBe(12.5);
    expect(await getWalletSpendableBalanceEur(seller.id)).toBe(12.5);
  });

  it("retrait : rejette INSUFFICIENT_EARNED (le dépôt ne compte pas) sans modifier la base", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    await creditTestWallet(seller.id, 100); // gros dépôt, mais earned = 12.50 seulement
    const before = await walletOf(seller.id);

    await expect(
      debitWalletForWithdrawal({ userId: seller.id, amountEur: 20, stripeTransferId: `${TAG}-tr1` }),
    ).rejects.toThrow("INSUFFICIENT_EARNED");

    const after = await walletOf(seller.id);
    expect(after).toEqual(before);
    const entries = await prisma.walletLedgerEntry.count({
      where: { stripeTransferId: `${TAG}-tr1` },
    });
    expect(entries).toBe(0);
  });

  it("retrait : débite les gains et journalise (idempotent par transfert)", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    await debitWalletForWithdrawal({ userId: seller.id, amountEur: 10, stripeTransferId: `${TAG}-tr2` });
    await debitWalletForWithdrawal({ userId: seller.id, amountEur: 10, stripeTransferId: `${TAG}-tr2` });

    const w = await walletOf(seller.id);
    expect(w.earned).toBe(2.5);
    expect(w.deposit).toBe(100);

    const entry = await prisma.walletLedgerEntry.findUniqueOrThrow({
      where: { stripeTransferId: `${TAG}-tr2` },
    });
    expect(Number(entry.amount)).toBe(-10);
    expect(Number(entry.balanceAfter)).toBe(102.5);
  });

  it("withdrawEarnedToBank rejette STRIPE_NOT_CONFIGURED en environnement simulé", async () => {
    const seller = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u3@qa.test` } });
    await expect(withdrawEarnedToBank(seller.id, 10)).rejects.toThrow("STRIPE_NOT_CONFIGURED");
  });

  it("intégrité du ledger : le solde final égale la somme des mouvements et le dernier balanceAfter", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `${TAG}-u1@qa.test` } });
    const account = await prisma.walletAccount.findUniqueOrThrow({ where: { userId: user.id } });
    const entries = await prisma.walletLedgerEntry.findMany({
      where: { walletAccountId: account.id },
      orderBy: { createdAt: "asc" },
    });

    const sum = entries.reduce((s, e) => s + Number(e.amount), 0);
    const balance = Number(account.depositBalance) + Number(account.earnedBalance);
    expect(Math.round(sum * 100) / 100).toBe(balance);
    expect(Number(entries[entries.length - 1].balanceAfter)).toBe(balance);
  });
});
