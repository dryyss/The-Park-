import "server-only";
import { prisma } from "@/lib/prisma";
import type { ConversationContext } from "@/generated/prisma/client";

export interface AdminConversationRow {
  id: string;
  context: ConversationContext;
  participantNames: string[];
  messageCount: number;
  lastMessageAt: Date | null;
  lastPreview: string | null;
  involvesMinor: boolean;
  reportCount: number;
  exchangeId: string | null;
  saleId: string | null;
  disputeId: string | null;
}

export interface AdminThreadMessage {
  id: string;
  body: string;
  attachments: string[];
  senderId: string;
  senderName: string;
  createdAt: Date;
}

export interface AdminConversationThread {
  id: string;
  context: ConversationContext;
  participants: { id: string; name: string }[];
  messages: AdminThreadMessage[];
  involvesMinor: boolean;
  disputeId: string | null;
}

function ageFromBirthDate(birthDate: Date, now: Date): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

export async function listAdminConversations(input: {
  q?: string;
  flaggedOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminConversationRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 25));
  const now = new Date();

  const messageReports = input.flaggedOnly
    ? await prisma.report.findMany({
        where: { targetType: "MESSAGE", status: { in: ["PENDING", "REVIEWING"] } },
        select: { targetId: true },
      })
    : [];

  const flaggedMessageIds = messageReports.map((r) => r.targetId);
  const flaggedConvIds =
    flaggedMessageIds.length > 0
      ? (
          await prisma.message.findMany({
            where: { id: { in: flaggedMessageIds } },
            select: { conversationId: true },
            distinct: ["conversationId"],
          })
        ).map((m) => m.conversationId)
      : [];

  if (input.flaggedOnly && flaggedConvIds.length === 0) {
    return { rows: [], total: 0, page, pageSize };
  }

  const where = {
    ...(input.flaggedOnly ? { id: { in: flaggedConvIds } } : {}),
    ...(input.q?.trim()
      ? {
          participants: {
            some: {
              user: {
                OR: [
                  { displayName: { contains: input.q.trim(), mode: "insensitive" as const } },
                  { email: { contains: input.q.trim(), mode: "insensitive" as const } },
                ],
              },
            },
          },
        }
      : {}),
  };

  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        participants: {
          include: { user: { select: { id: true, displayName: true, birthDate: true } } },
        },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  const convIds = conversations.map((c) => c.id);
  const allMessageIds = conversations.flatMap((c) => c.messages.map((m) => m.id));
  const reportCounts =
    allMessageIds.length > 0
      ? await prisma.report.groupBy({
          by: ["targetId"],
          where: { targetType: "MESSAGE", targetId: { in: allMessageIds }, status: { in: ["PENDING", "REVIEWING"] } },
          _count: { _all: true },
        })
      : [];
  const reportsByMessage = new Map(reportCounts.map((r) => [r.targetId, r._count._all]));

  const rows: AdminConversationRow[] = conversations.map((conv) => {
    const last = conv.messages[0];
    const involvesMinor = conv.participants.some(
      (p) => p.user.birthDate != null && ageFromBirthDate(p.user.birthDate, now) < 18,
    );
    let reportCount = 0;
    if (last) reportCount = reportsByMessage.get(last.id) ?? 0;

    return {
      id: conv.id,
      context: conv.context,
      participantNames: conv.participants.map((p) => p.user.displayName),
      messageCount: conv._count.messages,
      lastMessageAt: last?.createdAt ?? null,
      lastPreview: last
        ? last.body.trim() || (last.attachments.length > 0 ? "📷" : "—")
        : null,
      involvesMinor,
      reportCount,
      exchangeId: conv.exchangeId,
      saleId: conv.saleId,
      disputeId: conv.disputeId,
    };
  });

  return { rows, total, page, pageSize };
}

export async function getAdminConversationThread(conversationId: string): Promise<AdminConversationThread | null> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, displayName: true } } },
      },
      participants: {
        include: { user: { select: { id: true, displayName: true, birthDate: true } } },
      },
    },
  });
  if (!conv) return null;

  const now = new Date();
  const involvesMinor = conv.participants.some(
    (p) => p.user.birthDate != null && ageFromBirthDate(p.user.birthDate, now) < 18,
  );

  return {
    id: conv.id,
    context: conv.context,
    participants: conv.participants.map((p) => ({ id: p.user.id, name: p.user.displayName })),
    involvesMinor,
    disputeId: conv.disputeId,
    messages: conv.messages.map((m) => ({
      id: m.id,
      body: m.body.trim() ? m.body : "",
      attachments: m.attachments,
      senderId: m.senderId,
      senderName: m.sender.displayName,
      createdAt: m.createdAt,
    })),
  };
}

export async function getMessagesAdminStats() {
  const [total, flagged, minorThreads] = await Promise.all([
    prisma.conversation.count(),
    prisma.report.count({ where: { targetType: "MESSAGE", status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.conversationParticipant.count({
      where: {
        user: {
          birthDate: { gt: new Date(new Date().setFullYear(new Date().getFullYear() - 18)) },
        },
      },
    }),
  ]);
  return { total, flagged, minorThreads };
}
