import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { creditWalletReferralBonus } from "@/server/wallet/wallet.service";
import { dispatchNotification } from "@/server/notification/notification.mutations";

/** Bonus versé au parrain ET au filleul, une fois le filleul qualifié (1er dépôt). */
export const REFERRAL_BONUS_EUR = 2;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1 (lisibilité)

function randomCode(len = 7): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Retourne le code de parrainage du membre, en le générant à la première demande. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

export interface ReferralOverview {
  code: string;
  bonusEur: number;
  alreadyReferred: boolean;
  totalEarnedEur: number;
  pendingCount: number;
  rewardedCount: number;
  referrals: { name: string; status: "PENDING" | "REWARDED"; createdAt: Date }[];
}

export async function getReferralOverview(userId: string): Promise<ReferralOverview> {
  const [code, made, received] = await Promise.all([
    getOrCreateReferralCode(userId),
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        rewardCents: true,
        createdAt: true,
        referee: { select: { displayName: true } },
      },
    }),
    prisma.referral.findUnique({ where: { refereeId: userId }, select: { id: true } }),
  ]);

  const rewarded = made.filter((r) => r.status === "REWARDED");
  return {
    code,
    bonusEur: REFERRAL_BONUS_EUR,
    alreadyReferred: Boolean(received),
    totalEarnedEur: rewarded.reduce((s, r) => s + r.rewardCents, 0) / 100,
    pendingCount: made.length - rewarded.length,
    rewardedCount: rewarded.length,
    referrals: made.map((r) => ({
      name: r.referee.displayName,
      status: r.status,
      createdAt: r.createdAt,
    })),
  };
}

export type AttachReferralResult =
  | "OK"
  | "INVALID_CODE"
  | "SELF"
  | "ALREADY_REFERRED";

/** Rattache un filleul à un parrain via son code. PENDING jusqu'au 1er dépôt du filleul. */
export async function attachReferralByCode(
  refereeId: string,
  rawCode: string,
): Promise<AttachReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return "INVALID_CODE";

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) return "INVALID_CODE";
  if (referrer.id === refereeId) return "SELF";

  const existing = await prisma.referral.findUnique({
    where: { refereeId },
    select: { id: true },
  });
  if (existing) return "ALREADY_REFERRED";

  try {
    await prisma.referral.create({
      data: { referrerId: referrer.id, refereeId, status: "PENDING" },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return "ALREADY_REFERRED";
    }
    throw err;
  }
  return "OK";
}

/**
 * Débloque la récompense de parrainage quand le filleul se qualifie (1er dépôt).
 * Idempotent : seul un parrainage PENDING est traité, puis passé à REWARDED.
 */
export async function rewardReferralIfEligible(refereeId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { refereeId },
    select: { id: true, status: true, referrerId: true },
  });
  if (!referral || referral.status !== "PENDING") return;

  // Verrou logique : passer REWARDED d'abord, uniquement si encore PENDING.
  const claimed = await prisma.referral.updateMany({
    where: { id: referral.id, status: "PENDING" },
    data: { status: "REWARDED", rewardedAt: new Date(), rewardCents: REFERRAL_BONUS_EUR * 100 },
  });
  if (claimed.count === 0) return;

  await Promise.all([
    creditWalletReferralBonus({ userId: referral.referrerId, creditEur: REFERRAL_BONUS_EUR, note: "referral.bonusReferrer" }),
    creditWalletReferralBonus({ userId: refereeId, creditEur: REFERRAL_BONUS_EUR, note: "referral.bonusReferee" }),
    dispatchNotification({
      userId: referral.referrerId,
      type: "REFERRAL_REWARD",
      entityType: "referral",
      entityId: referral.id,
      payload: { amount: `${REFERRAL_BONUS_EUR} €` },
    }),
    dispatchNotification({
      userId: refereeId,
      type: "REFERRAL_REWARD",
      entityType: "referral",
      entityId: referral.id,
      payload: { amount: `${REFERRAL_BONUS_EUR} €` },
    }),
  ]);
}
