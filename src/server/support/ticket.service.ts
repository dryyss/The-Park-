import "server-only";
import { prisma } from "@/lib/prisma";
import type { SupportTicketStatus } from "@/generated/prisma/client";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { TICKET_CATEGORIES } from "@/lib/support-categories";

export interface TicketListItem {
  id: string;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  lastMessageAt: Date;
  createdAt: Date;
  userName?: string;
  messageCount: number;
}

export interface TicketMessageItem {
  id: string;
  body: string;
  isStaff: boolean;
  authorName: string;
  createdAt: Date;
}

export interface TicketThread {
  id: string;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  messages: TicketMessageItem[];
}

/** Crée un ticket avec son premier message. */
export async function createTicket(
  userId: string,
  input: { subject: string; category: string; body: string },
): Promise<string> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3 || subject.length > 160) throw new Error("INVALID_SUBJECT");
  if (body.length < 5 || body.length > 5000) throw new Error("INVALID_BODY");
  const category = (TICKET_CATEGORIES as readonly string[]).includes(input.category) ? input.category : "GENERAL";

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject,
      category,
      status: "OPEN",
      messages: { create: { authorId: userId, body, isStaff: false } },
    },
    select: { id: true },
  });
  return ticket.id;
}

export async function getUserTickets(userId: string): Promise<TicketListItem[]> {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });
  return tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    lastMessageAt: t.lastMessageAt,
    createdAt: t.createdAt,
    messageCount: t._count.messages,
  }));
}

/** File d'attente staff : tickets ouverts/en attente d'abord. */
export async function getStaffTicketQueue(): Promise<TicketListItem[]> {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
    take: 100,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      user: { select: { displayName: true } },
      _count: { select: { messages: true } },
    },
  });
  return tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    lastMessageAt: t.lastMessageAt,
    createdAt: t.createdAt,
    userName: t.user.displayName,
    messageCount: t._count.messages,
  }));
}

/** Thread complet — accessible au propriétaire OU au staff. Renvoie null sinon. */
export async function getTicketThread(
  ticketId: string,
  viewer: { id: string; isStaff: boolean },
): Promise<TicketThread | null> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      userId: true,
      createdAt: true,
      user: { select: { displayName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          isStaff: true,
          createdAt: true,
          author: { select: { displayName: true } },
        },
      },
    },
  });
  if (!ticket) return null;
  if (!viewer.isStaff && ticket.userId !== viewer.id) return null;

  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    ownerId: ticket.userId,
    ownerName: ticket.user.displayName,
    createdAt: ticket.createdAt,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      body: m.body,
      isStaff: m.isStaff,
      authorName: m.author.displayName,
      createdAt: m.createdAt,
    })),
  };
}

/** Ajoute une réponse. Le staff notifie le membre ; le membre rouvre le ticket. */
export async function postTicketMessage(
  ticketId: string,
  viewer: { id: string; isStaff: boolean },
  rawBody: string,
): Promise<void> {
  const body = rawBody.trim();
  if (body.length < 1 || body.length > 5000) throw new Error("INVALID_BODY");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, status: true },
  });
  if (!ticket) throw new Error("NOT_FOUND");
  if (!viewer.isStaff && ticket.userId !== viewer.id) throw new Error("FORBIDDEN");
  if (ticket.status === "CLOSED") throw new Error("TICKET_CLOSED");

  // Staff répond -> PENDING (attente membre) ; membre répond -> OPEN (file staff).
  const nextStatus: SupportTicketStatus = viewer.isStaff ? "PENDING" : "OPEN";

  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: { ticketId, authorId: viewer.id, body, isStaff: viewer.isStaff },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastMessageAt: new Date(), status: nextStatus },
    }),
  ]);

  if (viewer.isStaff && ticket.userId !== viewer.id) {
    await dispatchNotification({
      userId: ticket.userId,
      type: "TICKET_REPLY",
      actorId: viewer.id,
      entityType: "ticket",
      entityId: ticketId,
    }).catch(() => {});
  }
}

/** Staff : change le statut d'un ticket. */
export async function setTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<void> {
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
}
