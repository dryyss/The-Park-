import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique, mockFindFirst, mockTx, mockTransaction } = vi.hoisted(() => {
  const mockTx = {
    walletAccount: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    walletLedgerEntry: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    mockFindUnique: vi.fn(),
    mockFindFirst: vi.fn(),
    mockTx,
    mockTransaction: vi.fn((cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    walletAccount: { findUnique: mockFindUnique, upsert: vi.fn() },
    walletLedgerEntry: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      create: vi.fn(),
    },
    $transaction: mockTransaction,
  },
}));

import {
  debitWalletForSale,
  creditWalletForSaleRefund,
  creditWalletForSalePayout,
  debitWalletForWithdrawal,
} from "@/server/wallet/wallet.service";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockResolvedValue(null);
  mockFindUnique.mockResolvedValue(null);
});

describe("debitWalletForSale", () => {
  it("débite d'abord le dépôt puis les gains", async () => {
    mockTx.walletAccount.findUnique.mockResolvedValue({
      id: "wa1",
      depositBalance: 3,
      earnedBalance: 10,
    });
    mockTx.walletAccount.update.mockResolvedValue({});
    mockTx.walletLedgerEntry.create.mockResolvedValue({});

    await debitWalletForSale({ userId: "u1", saleId: "s1", amountEur: 5 });

    expect(mockTx.walletAccount.update).toHaveBeenCalledWith({
      where: { id: "wa1" },
      data: { depositBalance: 0, earnedBalance: 8 },
    });
    expect(mockTx.walletLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "PURCHASE", amount: -5, saleId: "s1" }),
      }),
    );
  });

  it("rejette si solde insuffisant", async () => {
    mockTx.walletAccount.findUnique.mockResolvedValue({
      id: "wa1",
      depositBalance: 2,
      earnedBalance: 1,
    });

    await expect(debitWalletForSale({ userId: "u1", saleId: "s1", amountEur: 5 })).rejects.toThrow(
      "INSUFFICIENT_CREDIT",
    );
  });

  it("est idempotent si achat déjà enregistré", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing" });

    await debitWalletForSale({ userId: "u1", saleId: "s1", amountEur: 5 });

    expect(mockTx.walletAccount.findUnique).not.toHaveBeenCalled();
  });
});

describe("creditWalletForSaleRefund", () => {
  it("crédite le solde dépôt", async () => {
    mockTx.walletAccount.upsert.mockResolvedValue({
      id: "wa1",
      depositBalance: 10,
      earnedBalance: 5,
    });
    mockTx.walletAccount.update.mockResolvedValue({});
    mockTx.walletLedgerEntry.create.mockResolvedValue({});

    await creditWalletForSaleRefund({ userId: "u1", saleId: "s1", amountEur: 8 });

    expect(mockTx.walletAccount.update).toHaveBeenCalledWith({
      where: { id: "wa1" },
      data: { depositBalance: 18 },
    });
    expect(mockTx.walletLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "REFUND", amount: 8 }),
      }),
    );
  });
});

describe("creditWalletForSalePayout", () => {
  it("crédite le solde gains vendeur", async () => {
    mockTx.walletAccount.upsert.mockResolvedValue({
      id: "wa1",
      depositBalance: 10,
      earnedBalance: 0,
    });
    mockTx.walletAccount.update.mockResolvedValue({});
    mockTx.walletLedgerEntry.create.mockResolvedValue({});

    await creditWalletForSalePayout({ userId: "seller", saleId: "s1", amountEur: 15 });

    expect(mockTx.walletAccount.update).toHaveBeenCalledWith({
      where: { id: "wa1" },
      data: { earnedBalance: 15 },
    });
    expect(mockTx.walletLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "SALE_PAYOUT", amount: 15 }),
      }),
    );
  });
});

describe("debitWalletForWithdrawal", () => {
  it("débite les gains après virement Connect", async () => {
    mockTx.walletAccount.findUnique.mockResolvedValue({
      id: "wa1",
      depositBalance: 20,
      earnedBalance: 50,
    });
    mockTx.walletAccount.update.mockResolvedValue({});
    mockTx.walletLedgerEntry.create.mockResolvedValue({});

    await debitWalletForWithdrawal({
      userId: "seller",
      amountEur: 25,
      stripeTransferId: "tr_123",
    });

    expect(mockTx.walletAccount.update).toHaveBeenCalledWith({
      where: { id: "wa1" },
      data: { earnedBalance: 25 },
    });
    expect(mockTx.walletLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "WITHDRAWAL",
          amount: -25,
          stripeTransferId: "tr_123",
        }),
      }),
    );
  });

  it("rejette si gains insuffisants", async () => {
    mockTx.walletAccount.findUnique.mockResolvedValue({
      id: "wa1",
      depositBalance: 100,
      earnedBalance: 3,
    });

    await expect(
      debitWalletForWithdrawal({ userId: "u1", amountEur: 10, stripeTransferId: "tr_x" }),
    ).rejects.toThrow("INSUFFICIENT_EARNED");
  });
});
