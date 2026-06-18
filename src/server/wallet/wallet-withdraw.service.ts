import "server-only";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { roundEur, WALLET_MIN_WITHDRAW_EUR } from "@/lib/wallet";
import { debitWalletForWithdrawal } from "@/server/wallet/wallet.service";
import { getWalletConnectStatus } from "@/server/wallet/wallet-connect.service";

export async function withdrawEarnedToBank(userId: string, amountEur: number): Promise<void> {
  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

  const amount = roundEur(amountEur);
  if (amount < WALLET_MIN_WITHDRAW_EUR) throw new Error("WITHDRAW_TOO_LOW");

  const connect = await getWalletConnectStatus(userId);
  if (!connect.payoutsEnabled) throw new Error("CONNECT_PAYOUTS_DISABLED");

  const [user, wallet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true },
    }),
    prisma.walletAccount.findUnique({
      where: { userId },
      select: { earnedBalance: true },
    }),
  ]);
  if (!user?.stripeConnectAccountId) throw new Error("CONNECT_NOT_SETUP");

  const earned = Number(wallet?.earnedBalance ?? 0);
  if (earned < amount) throw new Error("INSUFFICIENT_EARNED");

  const transfer = await getStripe().transfers.create({
    amount: Math.round(amount * 100),
    currency: "eur",
    destination: user.stripeConnectAccountId,
    metadata: { kind: "WALLET_WITHDRAW", userId, amountEur: String(amount) },
  });

  await debitWalletForWithdrawal({
    userId,
    amountEur: amount,
    stripeTransferId: transfer.id,
  });
}
