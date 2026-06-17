import "server-only";
import { prisma } from "@/lib/prisma";

/** Propose un échange — double validation requise ensuite. */
export async function proposeExchange(
  initiatorId: string,
  input: {
    recipientSlug: string;
    giveVariantIds: string[];
    message?: string;
    secured?: boolean;
  },
): Promise<string> {
  if (input.giveVariantIds.length === 0) throw new Error("NO_CARDS");

  const recipient = await prisma.user.findFirst({
    where: { slug: input.recipientSlug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!recipient) throw new Error("RECIPIENT_NOT_FOUND");
  if (recipient.id === initiatorId) throw new Error("SELF_EXCHANGE");

  const owned = await prisma.collectionItem.findMany({
    where: {
      userId: initiatorId,
      variantId: { in: input.giveVariantIds },
      quantity: { gt: 0 },
    },
    select: { variantId: true, condition: true, quantity: true, reservedQuantity: true },
  });

  if (owned.length !== input.giveVariantIds.length) throw new Error("NOT_OWNED");
  for (const o of owned) {
    if (o.reservedQuantity >= o.quantity) throw new Error("CARD_RESERVED");
  }

  const exchange = await prisma.$transaction(async (tx) => {
    const ex = await tx.exchange.create({
      data: {
        initiatorId,
        recipientId: recipient.id,
        status: "PROPOSED",
        secured: input.secured ?? false,
        message: input.message ?? null,
      },
    });

    for (const item of owned) {
      await tx.exchangeItem.create({
        data: {
          exchangeId: ex.id,
          fromInitiator: true,
          variantId: item.variantId,
          condition: item.condition,
          quantity: 1,
        },
      });
      await tx.collectionItem.updateMany({
        where: { userId: initiatorId, variantId: item.variantId, condition: item.condition },
        data: { reservedQuantity: { increment: 1 } },
      });
    }

    await tx.notification.create({
      data: {
        userId: recipient.id,
        type: "EXCHANGE_PROPOSED",
        entityType: "EXCHANGE",
        entityId: ex.id,
        payload: { message: input.message ?? null },
      },
    });

    await tx.conversation.create({
      data: {
        context: "EXCHANGE",
        exchangeId: ex.id,
        participants: {
          create: [{ userId: initiatorId }, { userId: recipient.id }],
        },
      },
    });

    return ex;
  });

  return exchange.id;
}

/** Accepte une proposition avec les cartes offertes par le destinataire. */
export async function acceptExchangeWithItems(
  recipientId: string,
  exchangeId: string,
  giveVariantIds: string[],
): Promise<void> {
  if (giveVariantIds.length === 0) throw new Error("NO_CARDS");

  const ex = await prisma.exchange.findFirst({
    where: { id: exchangeId, recipientId, status: "PROPOSED" },
    select: { id: true, initiatorId: true },
  });
  if (!ex) throw new Error("NOT_FOUND");

  const owned = await prisma.collectionItem.findMany({
    where: {
      userId: recipientId,
      variantId: { in: giveVariantIds },
      quantity: { gt: 0 },
    },
    select: { variantId: true, condition: true, quantity: true, reservedQuantity: true },
  });
  if (owned.length !== giveVariantIds.length) throw new Error("NOT_OWNED");
  for (const o of owned) {
    if (o.reservedQuantity >= o.quantity) throw new Error("CARD_RESERVED");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of owned) {
      await tx.exchangeItem.create({
        data: {
          exchangeId,
          fromInitiator: false,
          variantId: item.variantId,
          condition: item.condition,
          quantity: 1,
        },
      });
      await tx.collectionItem.updateMany({
        where: { userId: recipientId, variantId: item.variantId, condition: item.condition },
        data: { reservedQuantity: { increment: 1 } },
      });
    }

    await tx.exchange.update({
      where: { id: exchangeId },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    await tx.transactionEvent.create({
      data: {
        entityType: "EXCHANGE",
        entityId: exchangeId,
        fromStatus: "PROPOSED",
        toStatus: "ACCEPTED",
        event: "EXCHANGE_ACCEPTED",
        actorId: recipientId,
      },
    });
    await tx.notification.create({
      data: {
        userId: ex.initiatorId,
        type: "EXCHANGE_ACCEPTED",
        entityType: "EXCHANGE",
        entityId: exchangeId,
      },
    });
  });
}

/** Accepte une proposition d'échange (destinataire). */
export async function acceptExchange(recipientId: string, exchangeId: string): Promise<void> {
  const recipientItems = await prisma.exchangeItem.count({
    where: { exchangeId, fromInitiator: false },
  });
  if (recipientItems === 0) {
    throw new Error("RECIPIENT_CARDS_REQUIRED");
  }
  const ex = await prisma.exchange.findFirst({
    where: { id: exchangeId, recipientId, status: "PROPOSED" },
    select: { id: true, initiatorId: true },
  });
  if (!ex) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.exchange.update({
      where: { id: exchangeId },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    await tx.transactionEvent.create({
      data: {
        entityType: "EXCHANGE",
        entityId: exchangeId,
        fromStatus: "PROPOSED",
        toStatus: "ACCEPTED",
        event: "EXCHANGE_ACCEPTED",
        actorId: recipientId,
      },
    });
    await tx.notification.create({
      data: {
        userId: ex.initiatorId,
        type: "EXCHANGE_ACCEPTED",
        entityType: "EXCHANGE",
        entityId: exchangeId,
      },
    });
  });
}

/** Refuse ou annule une proposition. */
export async function cancelExchange(userId: string, exchangeId: string): Promise<void> {
  const ex = await prisma.exchange.findFirst({
    where: {
      id: exchangeId,
      OR: [{ initiatorId: userId }, { recipientId: userId }],
      status: "PROPOSED",
    },
    include: { items: { where: { fromInitiator: true } } },
  });
  if (!ex) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    for (const item of ex.items) {
      await tx.collectionItem.updateMany({
        where: { userId: ex.initiatorId, variantId: item.variantId, condition: item.condition },
        data: { reservedQuantity: { decrement: 1 } },
      });
    }
    await tx.exchange.update({
      where: { id: exchangeId },
      data: { status: "CANCELLED" },
    });
  });
}

/** Passe un échange accepté en attente d'expédition. */
export async function markExchangeAwaitingShipment(exchangeId: string, actorId: string): Promise<void> {
  const ex = await prisma.exchange.findFirst({
    where: { id: exchangeId, status: "ACCEPTED" },
  });
  if (!ex) throw new Error("NOT_FOUND");
  if (ex.initiatorId !== actorId && ex.recipientId !== actorId) throw new Error("FORBIDDEN");

  await prisma.exchange.update({
    where: { id: exchangeId },
    data: { status: "AWAITING_SHIPMENT" },
  });
}
