import "server-only";
import { prisma } from "@/lib/prisma";
import type { CaptureDecision, DisputeStatus, DisputeVerdict } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";
import { capturePurchase, refundPurchase, releaseToSeller } from "@/server/sale/sale-payment.service";

export interface AdminDisputeDetail {
  id: string;
  type: string;
  status: DisputeStatus;
  reason: string;
  involvesMinor: boolean;
  priority: number;
  openedAt: Date;
  dueAt: Date | null;
  claimant: { id: string; name: string };
  respondent: { id: string; name: string };
  saleId: string | null;
  exchangeId: string | null;
  orderId: string | null;
  auctionId: string | null;
  conversationId: string | null;
  evidence: {
    id: string;
    kind: string;
    mediaUrl: string;
    uploaderName: string;
    createdAt: Date;
  }[];
  payments: {
    id: string;
    kind: string;
    status: string;
    amount: string;
  }[];
  events: {
    id: string;
    event: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: Date;
  }[];
  resolution: {
    verdict: DisputeVerdict;
    captureDecision: CaptureDecision;
    captureAmount: string;
    notes: string | null;
    moderatorName: string;
    createdAt: Date;
  } | null;
}

export async function getAdminDisputeDetail(disputeId: string): Promise<AdminDisputeDetail | null> {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      claimant: { select: { id: true, displayName: true } },
      respondent: { select: { id: true, displayName: true } },
      evidence: {
        orderBy: { createdAt: "asc" },
        include: { uploader: { select: { displayName: true } } },
      },
      resolution: { include: { moderator: { select: { displayName: true } } } },
      conversation: { select: { id: true } },
    },
  });
  if (!dispute) return null;

  const entityId = dispute.saleId ?? dispute.exchangeId ?? dispute.orderId ?? dispute.auctionId;
  const entityType = dispute.saleId ? "SALE" : dispute.exchangeId ? "EXCHANGE" : dispute.orderId ? "ORDER" : dispute.auctionId ? "AUCTION" : null;

  const [payments, events] = await Promise.all([
    prisma.payment.findMany({
      where: {
        OR: [
          dispute.saleId ? { saleId: dispute.saleId } : undefined,
          dispute.exchangeId ? { exchangeId: dispute.exchangeId } : undefined,
          dispute.orderId ? { orderId: dispute.orderId } : undefined,
          dispute.auctionId ? { auctionId: dispute.auctionId } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true, kind: true, status: true, amount: true },
    }),
    entityType && entityId
      ? prisma.transactionEvent.findMany({
          where: { entityType, entityId },
          orderBy: { createdAt: "asc" },
          take: 30,
          select: { id: true, event: true, fromStatus: true, toStatus: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    id: dispute.id,
    type: dispute.type,
    status: dispute.status,
    reason: dispute.reason,
    involvesMinor: dispute.involvesMinor,
    priority: dispute.priority,
    openedAt: dispute.openedAt,
    dueAt: dispute.dueAt,
    claimant: { id: dispute.claimant.id, name: dispute.claimant.displayName },
    respondent: { id: dispute.respondent.id, name: dispute.respondent.displayName },
    saleId: dispute.saleId,
    exchangeId: dispute.exchangeId,
    orderId: dispute.orderId,
    auctionId: dispute.auctionId,
    conversationId: dispute.conversation?.id ?? null,
    evidence: dispute.evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      mediaUrl: e.mediaUrl,
      uploaderName: e.uploader.displayName,
      createdAt: e.createdAt,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      amount: formatPrice(Number(p.amount)),
    })),
    events,
    resolution: dispute.resolution
      ? {
          verdict: dispute.resolution.verdict,
          captureDecision: dispute.resolution.captureDecision,
          captureAmount: formatPrice(Number(dispute.resolution.captureAmount)),
          notes: dispute.resolution.notes,
          moderatorName: dispute.resolution.moderator.displayName,
          createdAt: dispute.resolution.createdAt,
        }
      : null,
  };
}

async function applyFinancialResolution(
  dispute: { saleId: string | null; exchangeId: string | null; type: string },
  captureDecision: CaptureDecision,
): Promise<void> {
  if (dispute.saleId) {
    const payment = await prisma.payment.findFirst({
      where: { saleId: dispute.saleId, kind: "PURCHASE" },
    });
    if (!payment) return;

    switch (captureDecision) {
      case "REFUND":
        await refundPurchase(payment.id);
        await prisma.sale.update({ where: { id: dispute.saleId }, data: { status: "REFUNDED" } });
        break;
      case "FULL":
        await capturePurchase(payment.id);
        await releaseToSeller(payment.id);
        await prisma.sale.update({ where: { id: dispute.saleId }, data: { status: "COMPLETED", completedAt: new Date() } });
        break;
      case "PARTIAL":
        await capturePurchase(payment.id);
        await releaseToSeller(payment.id);
        await prisma.sale.update({ where: { id: dispute.saleId }, data: { status: "COMPLETED", completedAt: new Date() } });
        break;
      case "NONE":
        if (payment.status === "AUTHORIZED" || payment.status === "REQUIRES_PAYMENT") {
          await refundPurchase(payment.id);
        }
        await prisma.sale.update({ where: { id: dispute.saleId }, data: { status: "CANCELLED" } });
        break;
    }
    return;
  }

  if (dispute.exchangeId) {
    const cautions = await prisma.payment.findMany({
      where: { exchangeId: dispute.exchangeId, kind: "CAUTION" },
    });
    for (const payment of cautions) {
      if (captureDecision === "REFUND" || captureDecision === "NONE") {
        await refundPurchase(payment.id);
      } else if (captureDecision === "FULL" || captureDecision === "PARTIAL") {
        await capturePurchase(payment.id);
      }
    }
    const finalStatus = captureDecision === "REFUND" ? "CANCELLED" : "COMPLETED";
    await prisma.exchange.update({
      where: { id: dispute.exchangeId },
      data: { status: finalStatus, completedAt: finalStatus === "COMPLETED" ? new Date() : undefined },
    });
  }
}

export async function resolveDisputeWithArbitration(input: {
  moderatorId: string;
  disputeId: string;
  verdict: DisputeVerdict;
  captureDecision: CaptureDecision;
  captureAmount?: number;
  notes?: string;
}): Promise<void> {
  const dispute = await prisma.dispute.findUnique({
    where: { id: input.disputeId },
    include: { resolution: true },
  });
  if (!dispute) throw new Error("NOT_FOUND");
  if (dispute.resolution) throw new Error("ALREADY_RESOLVED");
  if (!["OPEN", "UNDER_REVIEW", "AWAITING_EVIDENCE"].includes(dispute.status)) {
    throw new Error("INVALID_STATUS");
  }

  await applyFinancialResolution(dispute, input.captureDecision);

  await prisma.$transaction(async (tx) => {
    await tx.disputeResolution.create({
      data: {
        disputeId: input.disputeId,
        moderatorId: input.moderatorId,
        verdict: input.verdict,
        captureDecision: input.captureDecision,
        captureAmount: input.captureAmount ?? 0,
        notes: input.notes,
      },
    });
    await tx.dispute.update({
      where: { id: input.disputeId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId: input.moderatorId,
        action: "DISPUTE_ARBITRATED",
        targetType: "DISPUTE",
        targetId: input.disputeId,
        details: {
          verdict: input.verdict,
          captureDecision: input.captureDecision,
          captureAmount: input.captureAmount ?? 0,
        },
      },
    });
  });
}
