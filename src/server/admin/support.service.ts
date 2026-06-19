import "server-only";
import { prisma } from "@/lib/prisma";

export interface SupportOverview {
  activeMembers: number;
  newMembersWeek: number;
  ordersNeedingHelp: number;
  openReports: number;
  flaggedMessages: number;
  recentMembers: { displayName: string; email: string; slug: string; createdAt: Date }[];
  recentReports: { id: string; targetType: string; reason: string; reporterName: string; involvesMinor: boolean; createdAt: Date }[];
}

export async function getSupportOverview(): Promise<SupportOverview> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeMembers, newMembersWeek, ordersNeedingHelp, openReports, flaggedMessages, recentMembers, recentReports] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE", createdAt: { gte: weekAgo } } }),
    prisma.order.count({ where: { status: { in: ["PENDING", "PAID", "PREPARING"] } } }),
    prisma.report.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.report.count({ where: { targetType: "MESSAGE", status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { displayName: true, email: true, slug: true, createdAt: true },
    }),
    prisma.report.findMany({
      where: { status: { in: ["PENDING", "REVIEWING"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 10,
      include: { reporter: { select: { displayName: true } } },
    }),
  ]);

  return {
    activeMembers,
    newMembersWeek,
    ordersNeedingHelp,
    openReports,
    flaggedMessages,
    recentMembers,
    recentReports: recentReports.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      reason: r.reason,
      reporterName: r.reporter.displayName,
      involvesMinor: r.involvesMinor,
      createdAt: r.createdAt,
    })),
  };
}
