import "server-only";
import { prisma } from "@/lib/prisma";
import type { ExchangeStatus, ShipmentStatus } from "@/generated/prisma/client";

export interface SecurityProofView {
  id: string;
  kind: string;
  mediaUrl: string;
  serverRecordedAt: Date;
}

export interface SecurityShipmentView {
  id: string;
  status: ShipmentStatus;
  trackingNumber: string | null;
  dropToken: string | null;
  notShipDeadline: Date | null;
  guaranteeEndsAt: Date | null;
  isShipper: boolean;
  proofCount: number;
  proofs: SecurityProofView[];
  cautionStatus: string | null;
  cautionAmount: string | null;
}

export interface SecurityExchangeContext {
  id: string;
  shortId: string;
  status: ExchangeStatus;
  secured: boolean;
  partnerName: string;
  partnerSlug: string;
  itemCount: number;
  viewerIsInitiator: boolean;
  shipments: SecurityShipmentView[];
  viewerShipment: SecurityShipmentView | null;
}

/** Contexte C2C pour les pages /securite/* — échange actif + envois du membre. */
export async function getSecurityContext(userId: string): Promise<SecurityExchangeContext | null> {
  const ex = await prisma.exchange.findFirst({
    where: {
      OR: [{ initiatorId: userId }, { recipientId: userId }],
      status: {
        in: ["ACCEPTED", "AWAITING_SHIPMENT", "SHIPPED", "DELIVERED_WINDOW", "DELIVERED", "DISPUTED"],
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { displayName: true, slug: true } },
      recipient: { select: { displayName: true, slug: true } },
      items: { select: { id: true } },
      shipments: {
        include: {
          _count: { select: { proofs: true } },
          proofs: { select: { id: true, kind: true, mediaUrl: true, serverRecordedAt: true }, orderBy: { serverRecordedAt: "asc" } },
          payments: { where: { kind: "CAUTION" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!ex) return null;

  const isInitiator = ex.initiatorId === userId;
  const partner = isInitiator ? ex.recipient : ex.initiator;

  const shipments: SecurityShipmentView[] = ex.shipments.map((s) => {
    const caution = s.payments[0];
    return {
      id: s.id,
      status: s.status,
      trackingNumber: s.trackingNumber,
      dropToken: s.shipperId === userId ? s.dropToken : null,
      notShipDeadline: s.notShipDeadline,
      guaranteeEndsAt: s.guaranteeEndsAt,
      isShipper: s.shipperId === userId,
      proofCount: s._count.proofs,
      proofs: s.proofs,
      cautionStatus: caution?.status ?? null,
      cautionAmount: caution ? `${Number(caution.amount).toFixed(2).replace(".", ",")} €` : null,
    };
  });

  return {
    id: ex.id,
    shortId: `#${ex.id.slice(-6).toUpperCase()}`,
    status: ex.status,
    secured: ex.secured,
    partnerName: partner.displayName,
    partnerSlug: partner.slug,
    itemCount: ex.items.length,
    viewerIsInitiator: isInitiator,
    shipments,
    viewerShipment: shipments.find((s) => s.isShipper) ?? shipments.find((s) => !s.isShipper) ?? null,
  };
}
