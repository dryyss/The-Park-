import { describe, it, expect } from "vitest";
import {
  quoteWalletTopUp,
  roundEur,
  WALLET_MIN_TOP_UP_EUR,
  WALLET_MIN_WITHDRAW_EUR,
  WALLET_TOP_UP_FEE_PCT,
} from "@/lib/wallet";

describe("quoteWalletTopUp", () => {
  it("ajoute 5 % de frais au crédit", () => {
    const q = quoteWalletTopUp(5);
    expect(q.creditEur).toBe(5);
    expect(q.feeEur).toBe(0.25);
    expect(q.totalChargeEur).toBe(5.25);
  });

  it("refuse les montants sous le minimum via constante", () => {
    expect(WALLET_MIN_TOP_UP_EUR).toBe(5);
    expect(WALLET_TOP_UP_FEE_PCT).toBe(0.05);
  });

  it("arrondit à 2 décimales", () => {
    const q = quoteWalletTopUp(10.333);
    expect(q.creditEur).toBe(10.33);
    expect(q.feeEur).toBe(0.52);
    expect(q.totalChargeEur).toBe(10.85);
  });
});

describe("roundEur", () => {
  it("arrondit à 2 décimales (Math.round)", () => {
    expect(roundEur(1.006)).toBe(1.01);
    expect(roundEur(1.004)).toBe(1);
  });
});

describe("WALLET_MIN_WITHDRAW_EUR", () => {
  it("minimum retrait = 5 €", () => {
    expect(WALLET_MIN_WITHDRAW_EUR).toBe(5);
  });
});
