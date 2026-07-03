import { prisma } from "@/lib/prisma";
import type { CardCondition, ListingType } from "@/generated/prisma/client";

/**
 * Fixtures des tests d'intégration.
 * Toutes les données créées portent un tag unique (emails `*@qa.test`, codes `QA-…`)
 * pour être identifiables et supprimées par cleanupTag() — la base est partagée.
 */

export function qaTag(): string {
  return `qa${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Suffixe unique par appel de createTestCatalog (plusieurs catalogues par tag/fichier).
let catalogSeq = 0;
function nextCatalogSuffix(): string {
  catalogSeq += 1;
  return `${catalogSeq}${Math.random().toString(36).slice(2, 5)}`;
}

export async function createTestUser(
  tag: string,
  n: number,
  overrides: Partial<Parameters<typeof prisma.user.create>[0]["data"]> = {},
) {
  return prisma.user.create({
    data: {
      email: `${tag}-u${n}@qa.test`,
      displayName: `QA ${tag} u${n}`,
      slug: `${tag}-u${n}`,
      status: "ACTIVE",
      ...overrides,
    },
  });
}

/** Season + Rarity + VersionType + Card + CardVariant dédiés au tag (aucune table de réf partagée). */
export async function createTestCatalog(tag: string, cardCount = 1) {
  const sfx = nextCatalogSuffix();
  const rarity = await prisma.rarity.create({
    data: { code: `QA-${tag}-r${sfx}`, label: `QA ${tag} rarity` },
  });
  const versionType = await prisma.versionType.create({
    data: { code: `QA-${tag}-v${sfx}`, label: `QA ${tag} version` },
  });
  const season = await prisma.season.create({
    data: { code: `QA-${tag}-${sfx}`, name: `QA Season ${tag}` },
  });

  const cards = [];
  const variants = [];
  for (let n = 1; n <= cardCount; n++) {
    const card = await prisma.card.create({
      data: {
        seasonId: season.id,
        number: n,
        name: `QA Card ${tag} #${n}`,
        slug: `qa-${tag}-${sfx}-card-${n}`,
        rarityId: rarity.id,
      },
    });
    const variant = await prisma.cardVariant.create({
      data: { cardId: card.id, versionTypeId: versionType.id, language: "FR" },
    });
    cards.push(card);
    variants.push(variant);
  }

  return { season, rarity, versionType, cards, variants };
}

export async function addToCollection(
  userId: string,
  variantId: string,
  opts: { condition?: CardCondition; quantity?: number } = {},
) {
  return prisma.collectionItem.create({
    data: {
      userId,
      variantId,
      condition: opts.condition ?? "EXCELLENT",
      quantity: opts.quantity ?? 1,
    },
  });
}

export async function createTestListing(
  sellerId: string,
  variantId: string,
  opts: { type?: ListingType; price?: number; condition?: CardCondition } = {},
) {
  return prisma.listing.create({
    data: {
      sellerId,
      variantId,
      type: opts.type ?? "SELL",
      status: "ACTIVE",
      price: opts.price ?? 10,
      condition: opts.condition ?? "EXCELLENT",
    },
  });
}

/** Crédite le wallet interne d'un utilisateur (dépôt simulé, hors Stripe). */
export async function creditTestWallet(userId: string, amountEur: number) {
  const account = await prisma.walletAccount.upsert({
    where: { userId },
    create: { userId, depositBalance: amountEur },
    update: { depositBalance: { increment: amountEur } },
  });
  await prisma.walletLedgerEntry.create({
    data: {
      walletAccountId: account.id,
      type: "TOP_UP",
      amount: amountEur,
      balanceAfter: account.depositBalance,
      note: "QA fixture top-up",
    },
  });
  return account;
}

/**
 * Supprime tout ce qui a été créé sous ce tag, dans un ordre compatible FK.
 * Chaque étape est tolérante : on collecte les erreurs et on retente une passe.
 */
export async function cleanupTag(tag: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${tag}-`, endsWith: "@qa.test" } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const seasons = await prisma.season.findMany({
    where: { code: { startsWith: `QA-${tag}` } },
    select: { id: true },
  });
  const seasonIds = seasons.map((s) => s.id);
  const cards = await prisma.card.findMany({
    where: { seasonId: { in: seasonIds } },
    select: { id: true },
  });
  const cardIds = cards.map((c) => c.id);
  const variants = await prisma.cardVariant.findMany({
    where: { cardId: { in: cardIds } },
    select: { id: true },
  });
  const variantIds = variants.map((v) => v.id);

  const byUsers = userIds.length > 0;

  const sales = byUsers
    ? await prisma.sale.findMany({
        where: { OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }] },
        select: { id: true },
      })
    : [];
  const saleIds = sales.map((s) => s.id);
  const auctions = await prisma.auction.findMany({
    where: byUsers
      ? { OR: [{ sellerId: { in: userIds } }, { variantId: { in: variantIds } }] }
      : { variantId: { in: variantIds } },
    select: { id: true },
  });
  const auctionIds = auctions.map((a) => a.id);
  const exchanges = byUsers
    ? await prisma.exchange.findMany({
        where: { OR: [{ initiatorId: { in: userIds } }, { recipientId: { in: userIds } }] },
        select: { id: true },
      })
    : [];
  const exchangeIds = exchanges.map((e) => e.id);
  const orders = byUsers
    ? await prisma.order.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const orderIds = orders.map((o) => o.id);
  const entityIds = [...saleIds, ...auctionIds, ...exchangeIds, ...orderIds];

  const steps: Array<() => Promise<unknown>> = [
    () => prisma.transactionEvent.deleteMany({ where: { entityId: { in: entityIds } } }),
    () =>
      prisma.notification.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { actorId: { in: userIds } }] },
      }),
    () => prisma.shipmentProof.deleteMany({ where: { shipment: { shipperId: { in: userIds } } } }),
    () => prisma.trackingEvent.deleteMany({ where: { shipment: { shipperId: { in: userIds } } } }),
    () =>
      prisma.disputeEvidence.deleteMany({
        where: { dispute: { OR: [{ claimantId: { in: userIds } }, { respondentId: { in: userIds } }] } },
      }),
    () =>
      prisma.disputeResolution.deleteMany({
        where: { dispute: { OR: [{ claimantId: { in: userIds } }, { respondentId: { in: userIds } }] } },
      }),
    () =>
      prisma.dispute.deleteMany({
        where: { OR: [{ claimantId: { in: userIds } }, { respondentId: { in: userIds } }] },
      }),
    () =>
      prisma.review.deleteMany({
        where: { OR: [{ authorId: { in: userIds } }, { targetId: { in: userIds } }] },
      }),
    () =>
      prisma.payment.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { payeeId: { in: userIds } }] },
      }),
    () =>
      prisma.message.deleteMany({
        where: { conversation: { participants: { some: { userId: { in: userIds } } } } },
      }),
    () =>
      prisma.conversationParticipant.deleteMany({
        where: { conversation: { participants: { some: { userId: { in: userIds } } } } },
      }),
    () =>
      prisma.conversation.deleteMany({
        where: {
          OR: [
            { saleId: { in: saleIds } },
            { exchangeId: { in: exchangeIds } },
            { auctionId: { in: auctionIds } },
            { participants: { none: {} } },
          ],
        },
      }),
    () =>
      prisma.shipment.deleteMany({
        where: { OR: [{ shipperId: { in: userIds } }, { recipientId: { in: userIds } }] },
      }),
    () => prisma.sale.deleteMany({ where: { id: { in: saleIds } } }),
    () => prisma.bid.deleteMany({ where: { auctionId: { in: auctionIds } } }),
    () => prisma.auction.deleteMany({ where: { id: { in: auctionIds } } }),
    () => prisma.exchangeItem.deleteMany({ where: { exchangeId: { in: exchangeIds } } }),
    () => prisma.exchange.deleteMany({ where: { id: { in: exchangeIds } } }),
    () => prisma.marketplaceInvoice.deleteMany({ where: { checkout: { buyerId: { in: userIds } } } }),
    () =>
      prisma.marketplaceCheckoutLine.deleteMany({ where: { checkout: { buyerId: { in: userIds } } } }),
    () => prisma.marketplaceCheckout.deleteMany({ where: { buyerId: { in: userIds } } }),
    () =>
      prisma.marketplaceCartItem.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { listing: { sellerId: { in: userIds } } }] },
      }),
    () => prisma.marketplaceCartCooldown.deleteMany({ where: { userId: { in: userIds } } }),
    () =>
      prisma.listing.deleteMany({
        where: { OR: [{ sellerId: { in: userIds } }, { variantId: { in: variantIds } }] },
      }),
    () =>
      prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: { in: userIds } } } }),
    () => prisma.walletAccount.deleteMany({ where: { userId: { in: userIds } } }),
    () => prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    () => prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    () =>
      prisma.wishlistItem.deleteMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            { cardId: { in: cardIds } },
            { variantId: { in: variantIds } },
            { seasonId: { in: seasonIds } },
          ],
        },
      }),
    () =>
      prisma.cardLike.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { cardId: { in: cardIds } }] },
      }),
    () =>
      prisma.collectionItem.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { variantId: { in: variantIds } }] },
      }),
    () => prisma.userBadge.deleteMany({ where: { userId: { in: userIds } } }),
    () => prisma.rankStreak.deleteMany({ where: { userId: { in: userIds } } }),
    () =>
      prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: { in: userIds } }, { addresseeId: { in: userIds } }] },
      }),
    () =>
      prisma.report.deleteMany({
        where: { OR: [{ reporterId: { in: userIds } }, { targetType: "USER", targetId: { in: userIds } }] },
      }),
    () => prisma.moderationAction.deleteMany({ where: { targetUserId: { in: userIds } } }),
    () => prisma.connectionLog.deleteMany({ where: { userId: { in: userIds } } }),
    () => prisma.parentalConsent.deleteMany({ where: { userId: { in: userIds } } }),
    () => prisma.address.deleteMany({ where: { userId: { in: userIds } } }),
    () => prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    () => prisma.cardVariant.deleteMany({ where: { id: { in: variantIds } } }),
    () => prisma.card.deleteMany({ where: { id: { in: cardIds } } }),
    () => prisma.season.deleteMany({ where: { id: { in: seasonIds } } }),
    () => prisma.rarity.deleteMany({ where: { code: { startsWith: `QA-${tag}` } } }),
    () => prisma.versionType.deleteMany({ where: { code: { startsWith: `QA-${tag}` } } }),
  ];

  // Deux passes : la première peut échouer sur une FK dont la dépendance est
  // supprimée plus loin dans la liste ; la seconde nettoie le reste.
  for (let pass = 0; pass < 2; pass++) {
    const errors: string[] = [];
    for (const step of steps) {
      try {
        await step();
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (errors.length === 0) return;
    if (pass === 1) {
      // eslint-disable-next-line no-console
      console.warn(`[cleanupTag:${tag}] résidus possibles :`, errors.slice(0, 3));
    }
  }
}
