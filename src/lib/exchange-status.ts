import type { ExchangeStatus } from "@/generated/prisma/client";

export function exchangeStatusStyle(status: ExchangeStatus): { bg: string; color: string } {
  switch (status) {
    case "PROPOSED":
      return { bg: "rgba(79,163,255,0.15)", color: "#4FA3FF" };
    case "ACCEPTED":
    case "AWAITING_SHIPMENT":
      return { bg: "rgba(232,178,58,0.15)", color: "#E8B23A" };
    case "SHIPPED":
    case "DELIVERED_WINDOW":
      return { bg: "rgba(232,148,90,0.15)", color: "#E8945A" };
    case "DELIVERED":
      return { bg: "rgba(111,227,208,0.12)", color: "#6FE3D0" };
    case "COMPLETED":
      return { bg: "rgba(94,217,154,0.15)", color: "#5ED99A" };
    case "DISPUTED":
      return { bg: "rgba(255,46,99,0.15)", color: "#FF2E63" };
    case "CANCELLED":
    case "NOT_SHIPPED_CANCELLED":
    case "GUARANTEE_SUSPENDED":
      return { bg: "rgba(110,110,120,0.2)", color: "#8E8E98" };
    default:
      return { bg: "rgba(110,110,120,0.2)", color: "#8E8E98" };
  }
}

export const EXCHANGE_STATUS_I18N: Record<ExchangeStatus, string> = {
  PROPOSED: "proposed",
  ACCEPTED: "accepted",
  AWAITING_SHIPMENT: "awaitingShipment",
  SHIPPED: "shipped",
  DELIVERED_WINDOW: "deliveredWindow",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  GUARANTEE_SUSPENDED: "guaranteeSuspended",
  NOT_SHIPPED_CANCELLED: "notShippedCancelled",
  DISPUTED: "disputed",
  CANCELLED: "cancelled",
};
