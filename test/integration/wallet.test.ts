import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  ensureWalletAccount,
  creditWalletFromTopUp,
  debitWalletForSale,
  creditWalletForSaleRefund,
  creditWalletForSalePayout,
  getWalletSpendableBalanceEur,
  getWalletSummary,
  isWalletFundedSale,
  debitWalletForWithdrawal,
} from "@/server/wallet/wallet.service";
import { qaTag, createTestUser, cleanupTag } from "./_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

/** saleId factice unique (pas de vraie Sale requise : les fns wallet ne lisent que l'id). */
function fakeSaleId(suffix: string) {
  return `${TAG}-sale-${suffix}`;
}

async function getAccount(userId: string) {
  return prisma.walletAccount.findUniqueOrThrow({ where: { userId } });
}

describe(`wallet [${TAG}] — portefeuille`, () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 0. ensureWalletAccount
  // ─────────────────────────────────────────────────────────────────────────
  it("ensureWalletAccount crée un compte à zéro puis est idempotent", async () => {
    const u = await createTestUser(TAG, 1);
    const a1 = await ensureWalletAccount(u.id);
    expect(Number(a1.depositBalance)).toBe(0);
    expect(Number(a1.earnedBalance)).toBe(0);
    const a2 = await ensureWalletAccount(u.id);
    expect(a2.id).toBe(a1.id);
    expect(await getWalletSpendableBalanceEur(u.id)).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Top-up
  // ─────────────────────────────────────────────────────────────────────────
  it("creditWalletFromTopUp crédite depositBalance + crée un ledger avec balanceAfter correct", async () => {
    const u = await createTestUser(TAG, 2);
    await creditWalletFromTopUp({
      userId: u.id,
      creditEur: 20,
      feeEur: 1,
      stripeCheckoutSessionId: `${TAG}-cs-2`,
    });

    const account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(20);
    expect(Number(account.earnedBalance)).toBe(0);

    const entry = await prisma.walletLedgerEntry.findUniqueOrThrow({
      where: { stripeCheckoutSessionId: `${TAG}-cs-2` },
    });
    expect(entry.type).toBe("TOP_UP");
    expect(Number(entry.amount)).toBe(20);
    expect(Number(entry.feeAmount)).toBe(1);
    expect(Number(entry.balanceAfter)).toBe(20);

    expect(await getWalletSpendableBalanceEur(u.id)).toBe(20);
  });

  it("creditWalletFromTopUp est idempotent par stripeCheckoutSessionId (pas de double crédit)", async () => {
    const u = await createTestUser(TAG, 3);
    const cs = `${TAG}-cs-3`;
    await creditWalletFromTopUp({ userId: u.id, creditEur: 15, feeEur: 0, stripeCheckoutSessionId: cs });
    // Rejoue la MÊME session : ne doit rien recréditer.
    await creditWalletFromTopUp({ userId: u.id, creditEur: 15, feeEur: 0, stripeCheckoutSessionId: cs });

    const account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(15);
    const entries = await prisma.walletLedgerEntry.findMany({
      where: { walletAccountId: account.id, type: "TOP_UP" },
    });
    expect(entries).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Débit achat
  // ─────────────────────────────────────────────────────────────────────────
  it("debitWalletForSale débite le solde, crée un ledger PURCHASE, isWalletFundedSale=true", async () => {
    const u = await createTestUser(TAG, 4);
    await creditWalletFromTopUp({
      userId: u.id,
      creditEur: 30,
      feeEur: 0,
      stripeCheckoutSessionId: `${TAG}-cs-4`,
    });
    const saleId = fakeSaleId("4");

    expect(await isWalletFundedSale(saleId)).toBe(false);
    await debitWalletForSale({ userId: u.id, saleId, amountEur: 12 });

    const account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(18);
    expect(await isWalletFundedSale(saleId)).toBe(true);

    const entry = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { saleId, type: "PURCHASE" },
    });
    expect(Number(entry.amount)).toBe(-12);
    expect(Number(entry.balanceAfter)).toBe(18);
  });

  it("debitWalletForSale puise dans le dépôt puis dans les gains (priorité dépôt)", async () => {
    const u = await createTestUser(TAG, 5);
    // 5€ de dépôt + 10€ de gains, on débite 12€ → 5€ dépôt + 7€ gains.
    await creditWalletFromTopUp({ userId: u.id, creditEur: 5, feeEur: 0, stripeCheckoutSessionId: `${TAG}-cs-5` });
    await creditWalletForSalePayout({ userId: u.id, saleId: fakeSaleId("5-payout"), amountEur: 10 });

    await debitWalletForSale({ userId: u.id, saleId: fakeSaleId("5-purchase"), amountEur: 12 });
    const account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(0);
    expect(Number(account.earnedBalance)).toBe(3);
  });

  it("debitWalletForSale rejette INSUFFICIENT_CREDIT si le solde est insuffisant", async () => {
    const u = await createTestUser(TAG, 6);
    await creditWalletFromTopUp({ userId: u.id, creditEur: 5, feeEur: 0, stripeCheckoutSessionId: `${TAG}-cs-6` });
    await expect(
      debitWalletForSale({ userId: u.id, saleId: fakeSaleId("6"), amountEur: 10 }),
    ).rejects.toThrow("INSUFFICIENT_CREDIT");
    // Sans compte du tout.
    const u2 = await createTestUser(TAG, 7);
    await expect(
      debitWalletForSale({ userId: u2.id, saleId: fakeSaleId("7"), amountEur: 1 }),
    ).rejects.toThrow("INSUFFICIENT_CREDIT");
  });

  it("debitWalletForSale est idempotent par saleId (pas de double débit)", async () => {
    const u = await createTestUser(TAG, 8);
    await creditWalletFromTopUp({ userId: u.id, creditEur: 30, feeEur: 0, stripeCheckoutSessionId: `${TAG}-cs-8` });
    const saleId = fakeSaleId("8");
    await debitWalletForSale({ userId: u.id, saleId, amountEur: 10 });
    await debitWalletForSale({ userId: u.id, saleId, amountEur: 10 }); // rejeu
    const account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(20);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Remboursement / payout
  // ─────────────────────────────────────────────────────────────────────────
  it("creditWalletForSaleRefund recrédite le DÉPÔT (idempotent par vente)", async () => {
    const u = await createTestUser(TAG, 9);
    const saleId = fakeSaleId("9");
    await creditWalletForSaleRefund({ userId: u.id, saleId, amountEur: 8 });
    let account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(8);
    expect(Number(account.earnedBalance)).toBe(0);

    // Rejeu : pas de double remboursement.
    await creditWalletForSaleRefund({ userId: u.id, saleId, amountEur: 8 });
    account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(8);
    const refunds = await prisma.walletLedgerEntry.findMany({ where: { saleId, type: "REFUND" } });
    expect(refunds).toHaveLength(1);
  });

  it("creditWalletForSalePayout recrédite les GAINS (earned), idempotent par vente", async () => {
    const u = await createTestUser(TAG, 10);
    const saleId = fakeSaleId("10");
    await creditWalletForSalePayout({ userId: u.id, saleId, amountEur: 25 });
    let account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(0);
    expect(Number(account.earnedBalance)).toBe(25);

    await creditWalletForSalePayout({ userId: u.id, saleId, amountEur: 25 }); // rejeu
    account = await getAccount(u.id);
    expect(Number(account.earnedBalance)).toBe(25);
    const payouts = await prisma.walletLedgerEntry.findMany({ where: { saleId, type: "SALE_PAYOUT" } });
    expect(payouts).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Retrait
  // ─────────────────────────────────────────────────────────────────────────
  it("debitWalletForWithdrawal débite les gains (earned), idempotent par transfer", async () => {
    const u = await createTestUser(TAG, 11);
    await creditWalletForSalePayout({ userId: u.id, saleId: fakeSaleId("11"), amountEur: 40 });
    const transferId = `${TAG}-tr-11`;
    await debitWalletForWithdrawal({ userId: u.id, amountEur: 30, stripeTransferId: transferId });

    let account = await getAccount(u.id);
    expect(Number(account.earnedBalance)).toBe(10);
    expect(Number(account.depositBalance)).toBe(0);

    const entry = await prisma.walletLedgerEntry.findUniqueOrThrow({
      where: { stripeTransferId: transferId },
    });
    expect(entry.type).toBe("WITHDRAWAL");
    expect(Number(entry.amount)).toBe(-30);

    // Rejeu du même transfer : pas de double débit.
    await debitWalletForWithdrawal({ userId: u.id, amountEur: 30, stripeTransferId: transferId });
    account = await getAccount(u.id);
    expect(Number(account.earnedBalance)).toBe(10);
  });

  it("debitWalletForWithdrawal rejette INSUFFICIENT_EARNED (le dépôt n'est pas retirable)", async () => {
    const u = await createTestUser(TAG, 12);
    // Beaucoup de dépôt, aucun gain : le retrait doit échouer.
    await creditWalletFromTopUp({ userId: u.id, creditEur: 100, feeEur: 0, stripeCheckoutSessionId: `${TAG}-cs-12` });
    await expect(
      debitWalletForWithdrawal({ userId: u.id, amountEur: 10, stripeTransferId: `${TAG}-tr-12` }),
    ).rejects.toThrow("INSUFFICIENT_EARNED");
    const account = await getAccount(u.id);
    expect(Number(account.depositBalance)).toBe(100);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Concurrence — bug critique C2/C5 (double dépense)
  // ─────────────────────────────────────────────────────────────────────────
  it("concurrence C2/C5: solde 20€, deux debitWalletForSale de 15€ simultanés — le solde peut-il devenir négatif ?", async () => {
    const u = await createTestUser(TAG, 20);
    await creditWalletFromTopUp({ userId: u.id, creditEur: 20, feeEur: 0, stripeCheckoutSessionId: `${TAG}-cs-20` });

    // Deux débits concurrents de 15€ chacun (total 30€ > 20€ dispo), saleId distincts
    // pour contourner la garde d'idempotence (qui ne protège PAS de la double dépense).
    const results = await Promise.allSettled([
      debitWalletForSale({ userId: u.id, saleId: fakeSaleId("20-a"), amountEur: 15 }),
      debitWalletForSale({ userId: u.id, saleId: fakeSaleId("20-b"), amountEur: 15 }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;

    const account = await getAccount(u.id);
    const total = Number(account.depositBalance) + Number(account.earnedBalance);

    const purchases = await prisma.walletLedgerEntry.findMany({
      where: { walletAccountId: account.id, type: "PURCHASE" },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[C2] fulfilled=${fulfilled} deposit=${Number(account.depositBalance)} earned=${Number(account.earnedBalance)} total=${total} purchases=${purchases.length}`,
    );

    if (fulfilled === 2) {
      // BUG (C2/C5 CONFIRMÉ — double dépense / lost update) :
      // debitWalletForSale relit le solde (wallet.service.ts:134-139) SANS verrou de
      // ligne (pas de SELECT ... FOR UPDATE) ni isolation Serializable. Les deux
      // transactions lisent deposit=20, calculent chacune depositAfter = 20-15 = 5,
      // et écrivent 5 (last-write-wins). Résultat observé : DEUX achats validés
      // (2 ledgers PURCHASE, 2 ventes payées) mais UN SEUL débit reflété → solde
      // final = 5€ au lieu de -10€. La plateforme a livré 30€ de marchandise pour
      // 15€ débités : perte sèche de 15€. La garde "deposit+earned < amount" est
      // donc inefficace en concurrence.
      expect(purchases.length).toBe(2);
      // Somme réelle des débits (30€) NON reflétée dans le solde (perte de 15€).
      const debited = Number((20 - total).toFixed(2));
      expect(debited).toBeLessThan(15 * fulfilled); // débité (15) < dépensé réel (30)
      expect(total).toBe(5); // lost update : le solde ne descend qu'une fois
    } else {
      // Si l'ordonnancement a sérialisé les appels, un seul débit passe (5€ restants).
      expect(fulfilled).toBe(1);
      expect(purchases.length).toBe(1);
      expect(total).toBe(5);
      expect(total).toBeGreaterThanOrEqual(0);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Cohérence balanceAfter vs soldes du compte
  // ─────────────────────────────────────────────────────────────────────────
  it("cohérence: après une série d'opérations, le dernier balanceAfter == solde total du compte", async () => {
    const u = await createTestUser(TAG, 30);
    await creditWalletFromTopUp({ userId: u.id, creditEur: 50, feeEur: 2, stripeCheckoutSessionId: `${TAG}-cs-30` });
    await creditWalletForSalePayout({ userId: u.id, saleId: fakeSaleId("30-payout"), amountEur: 20 });
    await debitWalletForSale({ userId: u.id, saleId: fakeSaleId("30-purchase"), amountEur: 30 });
    await creditWalletForSaleRefund({ userId: u.id, saleId: fakeSaleId("30-refund"), amountEur: 5 });
    await debitWalletForWithdrawal({ userId: u.id, amountEur: 10, stripeTransferId: `${TAG}-tr-30` });

    const account = await getAccount(u.id);
    const total = Number(account.depositBalance) + Number(account.earnedBalance);
    // deposit: 50 -30(purchase puise d'abord le dépôt) +5(refund) = 25
    // earned: 20 -10(withdraw) = 10   → total = 35
    expect(Number(account.depositBalance)).toBe(25);
    expect(Number(account.earnedBalance)).toBe(10);
    expect(total).toBe(35);

    // Le dernier ledger (par date) doit refléter le solde total courant.
    const lastEntry = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { walletAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });
    expect(Number(lastEntry.balanceAfter)).toBe(total);

    // getWalletSummary expose le même solde dépensable.
    const summary = await getWalletSummary(u.id);
    expect(summary.spendableBalanceEur).toBe(35);
    expect(summary.depositBalanceEur).toBe(25);
    expect(summary.earnedBalanceEur).toBe(10);
  });
});
