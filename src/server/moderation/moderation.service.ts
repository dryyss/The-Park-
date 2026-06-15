import "server-only";
import { prisma } from "@/lib/prisma";
import type { DisputeStatus, ReportStatus } from "@/generated/prisma/client";

export interface ModerationReportRow {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  involvesMinor: boolean;
  status: ReportStatus;
  priority: number;
  createdAt: Date;
  reporterName: string;
}

export interface ModerationDisputeRow {
  id: string;
  type: string;
  status: DisputeStatus;
  reason: string;
  involvesMinor: boolean;
  priority: number;
  claimantName: string;
  respondentName: string;
  createdAt: Date;
}

export async function listPendingReports(): Promise<ModerationReportRow[]> {
  const rows = await prisma.report.findMany({
    where: { status: { in: ["PENDING", "REVIEWING"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 50,
    include: { reporter: { select: { displayName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    involvesMinor: r.involvesMinor,
    status: r.status,
    priority: r.priority,
    createdAt: r.createdAt,
    reporterName: r.reporter.displayName,
  }));
}

export async function listOpenDisputes(): Promise<ModerationDisputeRow[]> {
  const rows = await prisma.dispute.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_EVIDENCE"] } },
    orderBy: [{ priority: "desc" }, { openedAt: "asc" }],
    take: 50,
    include: {
      claimant: { select: { displayName: true } },
      respondent: { select: { displayName: true } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    reason: d.reason,
    involvesMinor: d.involvesMinor,
    priority: d.priority,
    claimantName: d.claimant.displayName,
    respondentName: d.respondent.displayName,
    createdAt: d.openedAt,
  }));
}

export async function resolveReport(
  moderatorId: string,
  reportId: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: reportId },
      data: { status },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
        targetType: "REPORT",
        targetId: reportId,
      },
    });
  });
}

export async function updateDisputeStatus(
  moderatorId: string,
  disputeId: string,
  status: DisputeStatus,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: disputeId },
      data: { status },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "DISPUTE_STATUS_UPDATED",
        targetType: "DISPUTE",
        targetId: disputeId,
        details: { status },
      },
    });
  });
}

export async function createReport(
  reporterId: string,
  input: {
    targetType: import("@/generated/prisma/client").ReportTargetType;
    targetId: string;
    reason: string;
    involvesMinor?: boolean;
  },
): Promise<string> {
  const priority = input.involvesMinor ? 100 : 0;
  const report = await prisma.report.create({
    data: {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      involvesMinor: input.involvesMinor ?? false,
      priority,
    },
  });
  return report.id;
}
