import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuctionStatus, Prisma } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";
import { roundEur } from "@/lib/wallet";

export interface AdminAuctionRow {
  id: string;
  cardName: string;
  cardNumber: number;
  sellerName: string;
  status: AuctionStatus;
  currentPrice: string;
  startPrice: string;
  bidCount: number;
  winnerName: string | null;
  startsAt: Date;
  endsAt: Date;
  reportCount: number;
  /** Recette cumulée des options « enchère automatique », déjà formatée. */
  optionRevenue: string;
  /** Détenteurs de l'option, pour le remboursement au cas par cas. */
  options: AdminAuctionOptionRow[];
}

export interface AdminAuctionOptionRow {
  id: string;
  userName: string;
  feePaid: string;
  refunded: boolean;
}

export async function listAdminAuctions(input: {
  status?: AuctionStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminAuctionRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));

  const where: Prisma.AuctionWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { seller: { displayName: { contains: q, mode: "insensitive" } } },
      { variant: { card: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      orderBy: { endsAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        seller: { select: { displayName: true } },
        winner: { select: { displayName: true } },
        variant: { include: { card: { select: { name: true, number: true } } } },
        autoBidOptions: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            feePaid: true,
            userId: true,
            user: { select: { displayName: true } },
          },
        },
        _count: { select: { bids: true } },
      },
    }),
  ]);

  const auctionIds = rows.map((r) => r.id);
  const reportCounts =
    auctionIds.length > 0
      ? await prisma.report.groupBy({
          by: ["targetId"],
          where: { targetType: "AUCTION", targetId: { in: auctionIds } },
          _count: { _all: true },
        })
      : [];
  const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count._all]));

  // Un remboursement laisse l'option en place — le membre l'a bien détenue, et la
  // retirer lui ôterait rétroactivement un plafond déjà armé. C'est la contrepartie
  // ADJUSTMENT au grand livre qui fait foi.
  const refundRows =
    auctionIds.length > 0
      ? await prisma.walletLedgerEntry.findMany({
          where: { auctionId: { in: auctionIds }, type: "ADJUSTMENT" },
          select: { auctionId: true, wallet: { select: { userId: true } } },
        })
      : [];
  const refunded = new Set(refundRows.map((r) => `${r.auctionId}:${r.wallet.userId}`));

  return {
    total,
    page,
    pageSize,
    rows: rows.map((a) => ({
      id: a.id,
      cardName: a.variant.card.name,
      cardNumber: a.variant.card.number,
      sellerName: a.seller.displayName,
      status: a.status,
      currentPrice: formatPrice(Number(a.currentPrice)),
      startPrice: formatPrice(Number(a.startPrice)),
      bidCount: a._count.bids,
      winnerName: a.winner?.displayName ?? null,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      reportCount: reportMap.get(a.id) ?? 0,
      // Recette nette : une option remboursée ne compte plus au chiffre d'affaires.
      optionRevenue: formatPrice(
        a.autoBidOptions
          .filter((o) => !refunded.has(`${a.id}:${o.userId}`))
          .reduce((sum, o) => sum + Number(o.feePaid), 0),
      ),
      options: a.autoBidOptions.map((o) => ({
        id: o.id,
        userName: o.user.displayName,
        feePaid: formatPrice(Number(o.feePaid)),
        refunded: refunded.has(`${a.id}:${o.userId}`),
      })),
    })),
  };
}

export async function adminCancelAuction(moderatorId: string, auctionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auctionId },
      data: { status: "CANCELLED" },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "AUCTION_CANCELLED",
        targetType: "AUCTION",
        targetId: auctionId,
      },
    });
  });
}

/**
 * Rembourse une option « enchère automatique » (geste commercial).
 *
 * L'option n'est pas supprimée : le membre l'a réellement détenue, et la retirer
 * lui ôterait rétroactivement un plafond déjà armé sur une enchère en cours. On
 * inscrit une contrepartie ADJUSTMENT, ce qui rend l'opération traçable et
 * idempotente sans nouveau type de mouvement.
 */
export async function adminRefundAuctionOption(
  moderatorId: string,
  optionId: string,
): Promise<void> {
  const option = await prisma.auctionAutoBidOption.findUnique({
    where: { id: optionId },
    select: { auctionId: true, userId: true, feePaid: true },
  });
  if (!option) throw new Error("OPTION_NOT_FOUND");

  const amount = roundEur(Number(option.feePaid));

  await prisma.$transaction(async (tx) => {
    const already = await tx.walletLedgerEntry.findFirst({
      where: {
        auctionId: option.auctionId,
        type: "ADJUSTMENT",
        wallet: { userId: option.userId },
      },
      select: { id: true },
    });
    if (already) return;

    const account = await tx.walletAccount.upsert({
      where: { userId: option.userId },
      create: { userId: option.userId, depositBalance: 0, earnedBalance: 0 },
      update: {},
    });

    // Recrédité en solde dépôt : c'est de là qu'il avait été prélevé.
    const depositAfter = roundEur(Number(account.depositBalance) + amount);
    const earnedAfter = roundEur(Number(account.earnedBalance));

    await tx.walletAccount.update({
      where: { id: account.id },
      data: { depositBalance: depositAfter },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: account.id,
        type: "ADJUSTMENT",
        amount,
        feeAmount: 0,
        balanceAfter: roundEur(depositAfter + earnedAfter),
        auctionId: option.auctionId,
        note: "wallet.auctionOptionRefundNote",
      },
    });

    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "AUCTION_OPTION_REFUNDED",
        targetType: "AUCTION",
        targetId: option.auctionId,
      },
    });
  });
}

export async function getAuctionsAdminStats() {
  const [active, scheduled, closed, reported, options] = await Promise.all([
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.auction.count({ where: { status: "SCHEDULED" } }),
    prisma.auction.count({ where: { status: { in: ["CLOSED", "SOLD"] } } }),
    prisma.report.count({
      where: { targetType: "AUCTION", status: { in: ["PENDING", "REVIEWING"] } },
    }),
    prisma.auctionAutoBidOption.aggregate({ _count: { _all: true }, _sum: { feePaid: true } }),
  ]);
  return {
    active,
    scheduled,
    closed,
    reported,
    optionsSold: options._count._all,
    optionsRevenue: formatPrice(Number(options._sum.feePaid ?? 0)),
  };
}
