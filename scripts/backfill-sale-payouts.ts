/**
 * Rattrape les ventes clôturées dont les gains n'ont jamais été crédités au vendeur
 * (paiements libérés avant la correction du 26/07/2026 : seules les ventes payées en
 * crédits créditaient le portefeuille, les ventes payées par carte ne créditaient rien).
 *
 * Usage : pnpm tsx scripts/backfill-sale-payouts.ts          (simulation)
 *         pnpm tsx scripts/backfill-sale-payouts.ts --apply  (écriture)
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

const roundEur = (v: number) => Math.round(v * 100) / 100;

/** Copie de creditWalletForSalePayout (le service importe "server-only", inutilisable en script). */
async function creditSalePayout(userId: string, saleId: string, amountEur: number): Promise<void> {
  const amount = roundEur(amountEur);
  if (amount <= 0) return;

  const existing = await prisma.walletLedgerEntry.findFirst({
    where: { saleId, type: "SALE_PAYOUT" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.walletAccount.upsert({
      where: { userId },
      create: { userId, depositBalance: 0, earnedBalance: 0 },
      update: {},
    });

    const depositAfter = roundEur(Number(account.depositBalance));
    const earnedAfter = roundEur(Number(account.earnedBalance) + amount);

    await tx.walletAccount.update({ where: { id: account.id }, data: { earnedBalance: earnedAfter } });
    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "SALE_PAYOUT",
        amount,
        feeAmount: 0,
        balanceAfter: roundEur(depositAfter + earnedAfter),
        saleId,
        note: "wallet.salePayoutNote",
      },
    });
  });
}

async function main() {
  const payments = await prisma.payment.findMany({
    where: { kind: "PURCHASE", status: "RELEASED", saleId: { not: null }, payeeId: { not: null } },
    include: {
      payee: { select: { displayName: true } },
      sale: { select: { status: true, completedAt: true } },
    },
    orderBy: { releasedAt: "asc" },
  });

  const missing: { saleId: string; userId: string; label: string; amount: number }[] = [];

  for (const p of payments) {
    const paid = await prisma.walletLedgerEntry.findFirst({
      where: { saleId: p.saleId!, type: "SALE_PAYOUT" },
      select: { id: true },
    });
    if (paid) continue;

    const net = Number(p.amount) - Number(p.applicationFee);
    if (net <= 0) continue;

    missing.push({
      saleId: p.saleId!,
      userId: p.payeeId!,
      label: `${p.payee?.displayName ?? p.payeeId} · vente ${p.saleId!.slice(0, 8)} (${p.sale?.status})`,
      amount: net,
    });
  }

  if (missing.length === 0) {
    console.log("✅ Aucun gain manquant : toutes les ventes libérées ont leur écriture SALE_PAYOUT.");
    return;
  }

  const total = missing.reduce((sum, m) => sum + m.amount, 0);
  console.log(`${missing.length} vente(s) sans crédit vendeur — total ${total.toFixed(2)} €\n`);
  for (const m of missing) console.log(`  ${m.label} → ${m.amount.toFixed(2)} €`);

  if (!APPLY) {
    console.log("\n(simulation — relancer avec --apply pour créditer)");
    return;
  }

  for (const m of missing) {
    await creditSalePayout(m.userId, m.saleId, m.amount);
    console.log(`  ✔ crédité : ${m.label}`);
  }
  console.log(`\n✅ ${missing.length} crédit(s) appliqué(s).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
