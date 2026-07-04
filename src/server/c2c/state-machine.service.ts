import "server-only";
import { prisma } from "@/lib/prisma";
import type { ExchangeStatus } from "@/generated/prisma/client";
import { dispatchNotification } from "@/server/notification/notification.mutations";

const GUARANTEE_MS = 72 * 60 * 60 * 1000;
const REAUTH_DELAY_MS = 5 * 24 * 60 * 60 * 1000; // J+5
export const MAX_GUARANTEE_EXTENSIONS = 2;

/** Chemin nominal de la machine à états d'un échange (hors branches d'interruption). */
export const EXCHANGE_HAPPY_PATH: ExchangeStatus[] = [
  "PROPOSED",
  "ACCEPTED",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "DELIVERED_WINDOW",
  "COMPLETED",
];

/** États d'interruption (terminaux ou litige). */
const INTERRUPT_STATES: ExchangeStatus[] = [
  "NOT_SHIPPED_CANCELLED",
  "GUARANTEE_SUSPENDED",
  "DISPUTED",
  "CANCELLED",
];

export interface StateStep {
  key: ExchangeStatus;
  reached: boolean;
  current: boolean;
}

export interface TimelineEvent {
  event: string;
  fromStatus: string | null;
  toStatus: string;
  at: Date;
  bySystem: boolean;
}

export interface ExchangeStateMachineView {
  exchangeId: string;
  shortId: string;
  status: ExchangeStatus;
  secured: boolean;
  interrupted: boolean;
  partnerName: string;
  steps: StateStep[];
  timeline: TimelineEvent[];
  deadlines: {
    /** Expédition avant (J+3). */
    shipBy: Date | null;
    /** Fin de la fenêtre garantie 72 h. */
    guaranteeUntil: Date | null;
    /** Ré-autorisation caution avant (J+5) — seulement si sécurisé. */
    reauthBy: Date | null;
  };
  guarantee: {
    extendedCount: number;
    maxExtensions: number;
    /** Le receveur peut prolonger la garantie (pendant la fenêtre, quota non atteint). */
    canExtend: boolean;
  };
}

function normalizeStatus(status: ExchangeStatus): ExchangeStatus {
  // DELIVERED se lit comme DELIVERED_WINDOW sur le chemin nominal (avant clôture).
  return status === "DELIVERED" ? "DELIVERED_WINDOW" : status;
}

/** Vue dynamique de la machine à états de l'échange sécurisé actif du membre. */
export async function getExchangeStateMachine(userId: string): Promise<ExchangeStateMachineView | null> {
  const ex = await prisma.exchange.findFirst({
    where: { OR: [{ initiatorId: userId }, { recipientId: userId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { displayName: true } },
      recipient: { select: { displayName: true } },
      shipments: {
        select: {
          recipientId: true,
          notShipDeadline: true,
          guaranteeEndsAt: true,
          guaranteeExtended: true,
          shippedAt: true,
        },
      },
    },
  });
  if (!ex) return null;

  const isInitiator = ex.initiatorId === userId;
  const partner = isInitiator ? ex.recipient : ex.initiator;
  const interrupted = INTERRUPT_STATES.includes(ex.status);

  const currentIndex = EXCHANGE_HAPPY_PATH.indexOf(normalizeStatus(ex.status));
  const steps: StateStep[] = EXCHANGE_HAPPY_PATH.map((key, i) => ({
    key,
    reached: !interrupted && currentIndex >= 0 && i <= currentIndex,
    current: !interrupted && i === currentIndex,
  }));

  const events = await prisma.transactionEvent.findMany({
    where: { entityType: "EXCHANGE", entityId: ex.id },
    orderBy: { createdAt: "asc" },
    select: { event: true, fromStatus: true, toStatus: true, createdAt: true, actorId: true },
  });

  // Colis que le membre reçoit (pour la prolongation garantie et la fenêtre).
  const incoming = ex.shipments.find((s) => s.recipientId === userId) ?? ex.shipments[0] ?? null;
  const shippedAt = ex.shipments.map((s) => s.shippedAt).filter(Boolean).sort()[0] ?? null;

  const extendedCount = incoming?.guaranteeExtended ?? 0;
  const canExtend =
    ex.status === "DELIVERED_WINDOW" &&
    incoming?.recipientId === userId &&
    incoming?.guaranteeEndsAt != null &&
    extendedCount < MAX_GUARANTEE_EXTENSIONS;

  return {
    exchangeId: ex.id,
    shortId: `#${ex.id.slice(-6).toUpperCase()}`,
    status: ex.status,
    secured: ex.secured,
    interrupted,
    partnerName: partner.displayName,
    steps,
    timeline: events.map((e) => ({
      event: e.event,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      at: e.createdAt,
      bySystem: e.actorId == null,
    })),
    deadlines: {
      shipBy: incoming?.notShipDeadline ?? null,
      guaranteeUntil: incoming?.guaranteeEndsAt ?? null,
      reauthBy: ex.secured && shippedAt ? new Date(shippedAt.getTime() + REAUTH_DELAY_MS) : null,
    },
    guarantee: { extendedCount, maxExtensions: MAX_GUARANTEE_EXTENSIONS, canExtend },
  };
}

export type ExtendGuaranteeResult =
  | { ok: true; newDeadline: Date }
  | { ok: false; error: "NOT_FOUND" | "NOT_RECIPIENT" | "NOT_IN_WINDOW" | "MAX_REACHED" };

/**
 * Prolonge la fenêtre de garantie de 72 h (le receveur a besoin de plus de temps
 * pour inspecter). Quota : 2 prolongations. Purement état — aucun flux financier.
 */
export async function extendGuaranteeWindow(
  exchangeId: string,
  userId: string,
): Promise<ExtendGuaranteeResult> {
  const ex = await prisma.exchange.findFirst({
    where: { id: exchangeId, OR: [{ initiatorId: userId }, { recipientId: userId }] },
    include: { shipments: true },
  });
  if (!ex) return { ok: false, error: "NOT_FOUND" };
  if (ex.status !== "DELIVERED_WINDOW") return { ok: false, error: "NOT_IN_WINDOW" };

  const shipment = ex.shipments.find((s) => s.recipientId === userId && s.guaranteeEndsAt != null);
  if (!shipment) return { ok: false, error: "NOT_RECIPIENT" };
  if (shipment.guaranteeExtended >= MAX_GUARANTEE_EXTENSIONS) return { ok: false, error: "MAX_REACHED" };

  const base = shipment.guaranteeEndsAt!.getTime();
  const newDeadline = new Date(base + GUARANTEE_MS);

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipment.id },
      data: { guaranteeEndsAt: newDeadline, guaranteeExtended: { increment: 1 } },
    }),
    prisma.transactionEvent.create({
      data: {
        entityType: "EXCHANGE",
        entityId: exchangeId,
        fromStatus: ex.status,
        toStatus: ex.status,
        event: "GUARANTEE_EXTENDED",
        actorId: userId,
        metadata: { newDeadline: newDeadline.toISOString(), extension: shipment.guaranteeExtended + 1 },
      },
    }),
  ]);

  const otherId = ex.initiatorId === userId ? ex.recipientId : ex.initiatorId;
  await dispatchNotification({
    userId: otherId,
    type: "GUARANTEE_EXPIRING",
    actorId: userId,
    entityType: "EXCHANGE",
    entityId: exchangeId,
  }).catch(() => {});

  return { ok: true, newDeadline };
}
