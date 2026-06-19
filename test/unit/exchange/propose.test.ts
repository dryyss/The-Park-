import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du client Prisma : $transaction exécute le callback avec un tx mocké.
vi.mock("@/lib/prisma", () => {
  const tx = {
    exchange: { create: vi.fn() },
    exchangeItem: { create: vi.fn() },
    collectionItem: { updateMany: vi.fn() },
    notification: { create: vi.fn() },
    conversation: { create: vi.fn() },
  };
  return {
    prisma: {
      user: { findFirst: vi.fn() },
      collectionItem: { findMany: vi.fn() },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      __tx: tx,
    },
  };
});

import { proposeExchange } from "@/server/exchange/exchange.mutations";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const tx = p.__tx;

const INITIATOR = "user-A";

beforeEach(() => {
  vi.clearAllMocks();
  p.user.findFirst.mockResolvedValue({ id: "user-B" });
  p.collectionItem.findMany.mockResolvedValue([]);
  tx.exchange.create.mockResolvedValue({ id: "ex-1" });
  tx.exchangeItem.create.mockResolvedValue({});
  tx.collectionItem.updateMany.mockResolvedValue({ count: 1 });
  tx.notification.create.mockResolvedValue({});
  tx.conversation.create.mockResolvedValue({});
});

describe("proposeExchange — validations", () => {
  it("refuse sans carte (NO_CARDS)", async () => {
    await expect(proposeExchange(INITIATOR, { recipientSlug: "b", giveVariantIds: [] })).rejects.toThrow(
      "NO_CARDS",
    );
  });

  it("refuse un destinataire introuvable", async () => {
    p.user.findFirst.mockResolvedValue(null);
    await expect(
      proposeExchange(INITIATOR, { recipientSlug: "ghost", giveVariantIds: ["v1"] }),
    ).rejects.toThrow("RECIPIENT_NOT_FOUND");
  });

  it("refuse un échange avec soi-même", async () => {
    p.user.findFirst.mockResolvedValue({ id: INITIATOR });
    await expect(
      proposeExchange(INITIATOR, { recipientSlug: "self", giveVariantIds: ["v1"] }),
    ).rejects.toThrow("SELF_EXCHANGE");
  });

  it("refuse une carte non possédée (NOT_OWNED)", async () => {
    p.collectionItem.findMany.mockResolvedValue([]);
    await expect(
      proposeExchange(INITIATOR, { recipientSlug: "b", giveVariantIds: ["v1"] }),
    ).rejects.toThrow("NOT_OWNED");
  });

  it("refuse une carte entièrement réservée (CARD_RESERVED)", async () => {
    p.collectionItem.findMany.mockResolvedValue([
      { variantId: "v1", condition: "EXCELLENT", quantity: 1, reservedQuantity: 1 },
    ]);
    await expect(
      proposeExchange(INITIATOR, { recipientSlug: "b", giveVariantIds: ["v1"] }),
    ).rejects.toThrow("CARD_RESERVED");
  });
});

describe("proposeExchange — variante multi-états (régression du bug NOT_OWNED)", () => {
  it("accepte quand une même variante existe en 2 états, en choisissant l'état disponible", async () => {
    // v1 possédée en MINT (réservée) ET EXCELLENT (dispo) : ne doit PAS jeter NOT_OWNED.
    p.collectionItem.findMany.mockResolvedValue([
      { variantId: "v1", condition: "MINT", quantity: 1, reservedQuantity: 1 },
      { variantId: "v1", condition: "EXCELLENT", quantity: 1, reservedQuantity: 0 },
    ]);

    const id = await proposeExchange(INITIATOR, { recipientSlug: "b", giveVariantIds: ["v1"] });

    expect(id).toBe("ex-1");
    // Un seul exchangeItem pour la variante, sur l'état disponible.
    expect(tx.exchangeItem.create).toHaveBeenCalledTimes(1);
    expect(tx.exchangeItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ variantId: "v1", condition: "EXCELLENT" }) }),
    );
    // La réservation est incrémentée sur le bon état.
    expect(tx.collectionItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ variantId: "v1", condition: "EXCELLENT" }),
        data: { reservedQuantity: { increment: 1 } },
      }),
    );
  });

  it("réserve une fois par variante distincte", async () => {
    p.collectionItem.findMany.mockResolvedValue([
      { variantId: "v1", condition: "EXCELLENT", quantity: 2, reservedQuantity: 0 },
      { variantId: "v2", condition: "GOOD", quantity: 1, reservedQuantity: 0 },
    ]);

    await proposeExchange(INITIATOR, { recipientSlug: "b", giveVariantIds: ["v1", "v2"] });

    expect(tx.exchangeItem.create).toHaveBeenCalledTimes(2);
    expect(tx.collectionItem.updateMany).toHaveBeenCalledTimes(2);
  });
});
