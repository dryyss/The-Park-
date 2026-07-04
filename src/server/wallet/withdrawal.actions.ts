"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { resolveStaffRole } from "@/server/auth/permissions.service";
import { debitWalletForWithdrawal } from "@/server/wallet/wallet.service";
import { roundEur, WALLET_MIN_WITHDRAW_EUR } from "@/lib/wallet";

export type WithdrawalActionResult = { ok: true; id?: string } | { ok: false; error: string };

const requestSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("BANK_TRANSFER"),
    amountEur: z.number().positive(),
    holder: z.string().min(2).max(120),
    iban: z
      .string()
      .min(15)
      .max(34)
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .refine((v) => /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(v), "IBAN"),
  }),
  z.object({
    method: z.literal("PAYPAL"),
    amountEur: z.number().positive(),
    paypalEmail: z.string().email().max(200),
  }),
]);

/** Demande de retrait manuel (virement SEPA ou PayPal) — débit immédiat des gains,
 *  versement traité par l'équipe The Park. */
export async function requestWithdrawalAction(input: unknown): Promise<WithdrawalActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const amount = roundEur(parsed.data.amountEur);
  if (amount < WALLET_MIN_WITHDRAW_EUR) return { ok: false, error: "MIN_AMOUNT" };

  const details =
    parsed.data.method === "BANK_TRANSFER"
      ? { holder: parsed.data.holder.trim(), iban: parsed.data.iban }
      : { paypalEmail: parsed.data.paypalEmail.trim() };

  try {
    const request = await prisma.withdrawalRequest.create({
      data: { userId: viewer.id, amount, method: parsed.data.method, details },
    });

    try {
      // Débit immédiat des gains (idempotent par référence de demande).
      await debitWalletForWithdrawal({
        userId: viewer.id,
        amountEur: amount,
        stripeTransferId: `withdrawal:${request.id}`,
      });
    } catch (err) {
      await prisma.withdrawalRequest.delete({ where: { id: request.id } });
      if (err instanceof Error && err.message === "INSUFFICIENT_EARNED") {
        return { ok: false, error: "INSUFFICIENT_EARNED" };
      }
      throw err;
    }

    revalidatePath("/portefeuille");
    return { ok: true, id: request.id };
  } catch (err) {
    console.error("[wallet:withdrawal-request]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/** Admin : marque une demande payée, ou la rejette (gains restitués). */
export async function processWithdrawalAction(
  requestId: string,
  decision: "PAID" | "REJECTED",
  adminNote?: string,
): Promise<WithdrawalActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer || !resolveStaffRole(viewer)) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const request = await prisma.withdrawalRequest.findFirst({
      where: { id: requestId, status: "PENDING" },
    });
    if (!request) return { ok: false, error: "NOT_FOUND" };

    if (decision === "REJECTED") {
      // Restitue les gains débités à la demande.
      const amount = Number(request.amount);
      await prisma.$transaction(async (tx) => {
        const account = await tx.walletAccount.findUnique({ where: { userId: request.userId } });
        if (!account) throw new Error("WALLET_NOT_FOUND");
        const earnedAfter = roundEur(Number(account.earnedBalance) + amount);
        await tx.walletAccount.update({ where: { id: account.id }, data: { earnedBalance: earnedAfter } });
        await tx.walletLedgerEntry.create({
          data: {
            walletAccountId: account.id,
            type: "ADJUSTMENT",
            amount,
            feeAmount: 0,
            balanceAfter: roundEur(Number(account.depositBalance) + earnedAfter),
            note: "wallet.withdrawRejectedNote",
          },
        });
      });
    }

    await prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        processedAt: new Date(),
        processedBy: viewer.id,
        adminNote: adminNote?.trim() || null,
      },
    });

    revalidatePath("/admin/retraits");
    revalidatePath("/portefeuille");
    return { ok: true };
  } catch (err) {
    console.error("[wallet:withdrawal-process]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}
