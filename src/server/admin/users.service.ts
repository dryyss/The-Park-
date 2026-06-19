import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccountStatus, AdminRole, UserRole, Prisma } from "@/generated/prisma/client";

export interface AdminUserRow {
  id: string;
  displayName: string;
  email: string;
  slug: string;
  role: UserRole;
  staffRole: AdminRole | null;
  status: AccountStatus;
  suspendedUntil: Date | null;
  bannedAt: Date | null;
  lastLoginAt: Date | null;
  ratingAvg: number;
  reviewCount: number;
  createdAt: Date;
}

export interface AdminUserListResult {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListUsersParams {
  q?: string;
  status?: AccountStatus;
  staffOnly?: boolean;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE = 25;

export async function listUsers(params: ListUsersParams = {}): Promise<AdminUserListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;

  const where: Prisma.UserWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.staffOnly) where.staffRole = { not: null };
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayName: true,
        email: true,
        slug: true,
        role: true,
        staffRole: true,
        status: true,
        suspendedUntil: true,
        bannedAt: true,
        lastLoginAt: true,
        ratingAvg: true,
        reviewCount: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

export interface AdminUserDetail extends AdminUserRow {
  bio: string | null;
  avatarUrl: string | null;
  counts: {
    listings: number;
    sales: number;
    exchanges: number;
    disputes: number;
    reportsMade: number;
  };
  reportsReceived: {
    id: string;
    reason: string;
    status: string;
    involvesMinor: boolean;
    createdAt: Date;
    reporterName: string;
  }[];
  moderationHistory: {
    id: string;
    action: string;
    moderatorName: string;
    details: unknown;
    createdAt: Date;
  }[];
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      slug: true,
      role: true,
      staffRole: true,
      status: true,
      suspendedUntil: true,
      bannedAt: true,
      lastLoginAt: true,
      ratingAvg: true,
      reviewCount: true,
      createdAt: true,
      bio: true,
      avatarUrl: true,
      _count: {
        select: {
          listings: true,
          salesAsSeller: true,
          exchangesInitiated: true,
          exchangesReceived: true,
          disputesAsClaimant: true,
          disputesAsRespondent: true,
          reportsMade: true,
        },
      },
    },
  });
  if (!user) return null;

  const [reportsReceived, moderationHistory] = await Promise.all([
    prisma.report.findMany({
      where: { targetType: "USER", targetId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { reporter: { select: { displayName: true } } },
    }),
    prisma.moderationAction.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { moderator: { select: { displayName: true } } },
    }),
  ]);

  const { _count, ...rest } = user;
  return {
    ...rest,
    counts: {
      listings: _count.listings,
      sales: _count.salesAsSeller,
      exchanges: _count.exchangesInitiated + _count.exchangesReceived,
      disputes: _count.disputesAsClaimant + _count.disputesAsRespondent,
      reportsMade: _count.reportsMade,
    },
    reportsReceived: reportsReceived.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      involvesMinor: r.involvesMinor,
      createdAt: r.createdAt,
      reporterName: r.reporter.displayName,
    })),
    moderationHistory: moderationHistory.map((m) => ({
      id: m.id,
      action: m.action,
      moderatorName: m.moderator.displayName,
      details: m.details,
      createdAt: m.createdAt,
    })),
  };
}
