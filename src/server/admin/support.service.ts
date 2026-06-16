import "server-only";
import { prisma } from "@/lib/prisma";

export interface SupportOverview {
  activeMembers: number;
  newMembersWeek: number;
  ordersNeedingHelp: number;
  openReports: number;
  recentMembers: { displayName: string; email: string; slug: string; createdAt: Date }[];
}

export async function getSupportOverview(): Promise<SupportOverview> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeMembers, newMembersWeek, ordersNeedingHelp, openReports, recentMembers] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE", createdAt: { gte: weekAgo } } }),
    prisma.order.count({ where: { status: { in: ["PENDING", "PAID", "PREPARING"] } } }),
    prisma.report.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { displayName: true, email: true, slug: true, createdAt: true },
    }),
  ]);

  return {
    activeMembers,
    newMembersWeek,
    ordersNeedingHelp,
    openReports,
    recentMembers,
  };
}
