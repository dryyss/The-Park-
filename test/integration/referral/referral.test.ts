import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateReferralCode,
  attachReferralByCode,
  rewardReferralIfEligible,
  REFERRAL_BONUS_EUR,
} from "@/server/referral/referral.service";
import { qaTag, createTestUser, cleanupTag } from "../_helpers/fixtures";

const TAG = qaTag();

let referrer: Awaited<ReturnType<typeof createTestUser>>;
let referee: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  referrer = await createTestUser(TAG, 1);
  referee = await createTestUser(TAG, 2);
});

afterAll(async () => {
  await cleanupTag(TAG);
});

async function depositBalance(userId: string): Promise<number> {
  const acc = await prisma.walletAccount.findUnique({ where: { userId }, select: { depositBalance: true } });
  return acc ? Number(acc.depositBalance) : 0;
}

describe(`parrainage [${TAG}]`, () => {
  it("génère un code stable et rattache un filleul", async () => {
    const code = await getOrCreateReferralCode(referrer.id);
    expect(code).toMatch(/^[A-Z0-9]{7}$/);
    // idempotent
    expect(await getOrCreateReferralCode(referrer.id)).toBe(code);

    expect(await attachReferralByCode(referee.id, code)).toBe("OK");
    // deuxième rattachement refusé
    expect(await attachReferralByCode(referee.id, code)).toBe("ALREADY_REFERRED");
  });

  it("refuse l'auto-parrainage et un code inconnu", async () => {
    const code = await getOrCreateReferralCode(referrer.id);
    expect(await attachReferralByCode(referrer.id, code)).toBe("SELF");
    expect(await attachReferralByCode(referrer.id, "ZZZZZZZ")).toBe("INVALID_CODE");
  });

  it("crédite parrain + filleul au 1er dépôt, une seule fois (idempotent)", async () => {
    const before = { r: await depositBalance(referrer.id), e: await depositBalance(referee.id) };

    await rewardReferralIfEligible(referee.id);
    const after1 = { r: await depositBalance(referrer.id), e: await depositBalance(referee.id) };
    expect(after1.r).toBeCloseTo(before.r + REFERRAL_BONUS_EUR, 2);
    expect(after1.e).toBeCloseTo(before.e + REFERRAL_BONUS_EUR, 2);

    // Rejeu : aucun crédit supplémentaire.
    await rewardReferralIfEligible(referee.id);
    const after2 = { r: await depositBalance(referrer.id), e: await depositBalance(referee.id) };
    expect(after2.r).toBeCloseTo(after1.r, 2);
    expect(after2.e).toBeCloseTo(after1.e, 2);

    const referral = await prisma.referral.findUnique({ where: { refereeId: referee.id }, select: { status: true } });
    expect(referral?.status).toBe("REWARDED");
  });
});
