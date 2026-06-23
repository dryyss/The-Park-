import "server-only";
import { prisma } from "@/lib/prisma";
import type { ConversationContext } from "@/generated/prisma/client";

export interface ConversationListItem {
  id: string;
  context: ConversationContext;
  contextLabel: string;
  partnerName: string;
  partnerInitial: string;
  partnerSlug: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unread: boolean;
  exchangeId: string | null;
  conversationCount: number;
}

export interface ThreadMessage {
  id: string;
  body: string;
  attachments: string[];
  senderId: string;
  senderName: string;
  senderInitial: string;
  isViewer: boolean;
  createdAt: Date;
}

export interface ConversationThread {
  id: string;
  context: ConversationContext;
  contextLabel: string;
  partnerName: string;
  partnerSlug: string;
  exchangeId: string | null;
  messages: ThreadMessage[];
}

const CONTEXT_LABEL: Record<ConversationContext, string> = {
  EXCHANGE: "exchange",
  SALE: "sale",
  AUCTION: "auction",
  DISPUTE: "dispute",
};

function asPartner(user: { displayName: string; slug: string }) {
  return { name: user.displayName, slug: user.slug, initial: user.displayName.charAt(0).toUpperCase() };
}

async function getPartner(
  conv: {
    exchange?: { initiatorId: string; recipientId: string; initiator: { displayName: string; slug: string }; recipient: { displayName: string; slug: string } } | null;
    participants?: { userId: string; user: { displayName: string; slug: string } }[];
  },
  viewerId: string,
) {
  // Conversation liée à un échange : le partenaire est l'autre partie de l'échange.
  if (conv.exchange) {
    const isInitiator = conv.exchange.initiatorId === viewerId;
    return asPartner(isInitiator ? conv.exchange.recipient : conv.exchange.initiator);
  }
  // Conversation directe (vente, contact) : le partenaire est l'autre participant.
  const other = conv.participants?.find((p) => p.userId !== viewerId)?.user;
  return other ? asPartner(other) : { name: "—", slug: "", initial: "?" };
}

export async function getViewerConversations(userId: string): Promise<ConversationListItem[]> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          participants: { include: { user: { select: { displayName: true, slug: true } } } },
          exchange: {
            include: {
              initiator: { select: { displayName: true, slug: true } },
              recipient: { select: { displayName: true, slug: true } },
            },
          },
        },
      },
    },
  });

  const raw: ConversationListItem[] = [];
  for (const p of participations) {
    const conv = p.conversation;
    const last = conv.messages[0];
    const partner = await getPartner(conv, userId);
    const unread = last != null && (p.lastReadAt == null || last.createdAt > p.lastReadAt) && last.senderId !== userId;
    const lastPreview =
      last == null
        ? null
        : last.body.trim()
          ? last.body
          : last.attachments.length > 0
            ? "📷 Photo"
            : null;

    raw.push({
      id: conv.id,
      context: conv.context,
      contextLabel: CONTEXT_LABEL[conv.context],
      partnerName: partner.name,
      partnerInitial: partner.initial,
      partnerSlug: partner.slug,
      lastMessage: lastPreview,
      lastMessageAt: last?.createdAt ?? null,
      unread,
      exchangeId: conv.exchangeId,
      conversationCount: 1,
    });
  }

  // Groupe par interlocuteur — 1 entrée par partenaire, la plus récente en tête.
  const grouped = new Map<string, ConversationListItem>();
  for (const item of raw) {
    const key = item.partnerSlug || item.partnerName;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item });
    } else {
      existing.conversationCount++;
      existing.unread = existing.unread || item.unread;
      const ta = item.lastMessageAt?.getTime() ?? 0;
      const te = existing.lastMessageAt?.getTime() ?? 0;
      if (ta > te) {
        existing.id = item.id;
        existing.context = item.context;
        existing.contextLabel = item.contextLabel;
        existing.lastMessage = item.lastMessage;
        existing.lastMessageAt = item.lastMessageAt;
        existing.exchangeId = item.exchangeId;
      }
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const ta = a.lastMessageAt?.getTime() ?? 0;
    const tb = b.lastMessageAt?.getTime() ?? 0;
    return tb - ta;
  });
}

function ageFromBirthDate(birthDate: Date, now: Date): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/** Vrai si au moins un participant de la conversation est mineur (< 18 ans). */
export async function conversationInvolvesMinor(conversationId: string): Promise<boolean> {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    include: { user: { select: { birthDate: true } } },
  });
  const now = new Date();
  return participants.some((p) => p.user.birthDate != null && ageFromBirthDate(p.user.birthDate, now) < 18);
}

/** Nombre de conversations avec au moins un message non lu (pour l'indicateur top-bar). */
export async function getUnreadConversationCount(userId: string): Promise<number> {
  const items = await getViewerConversations(userId);
  return items.filter((c) => c.unread).length;
}

export async function getConversationThread(
  conversationId: string,
  viewerId: string,
): Promise<ConversationThread | null> {
  const participation = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewerId } },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { id: true, displayName: true } } },
          },
          participants: { include: { user: { select: { displayName: true, slug: true } } } },
          exchange: {
            include: {
              initiator: { select: { displayName: true, slug: true } },
              recipient: { select: { displayName: true, slug: true } },
            },
          },
        },
      },
    },
  });
  if (!participation) return null;

  const conv = participation.conversation;
  const partner = await getPartner(conv, viewerId);

  return {
    id: conv.id,
    context: conv.context,
    contextLabel: CONTEXT_LABEL[conv.context],
    partnerName: partner.name,
    partnerSlug: partner.slug,
    exchangeId: conv.exchangeId,
    messages: conv.messages.map((m) => ({
      id: m.id,
      body: m.body.trim() ? m.body : "",
      attachments: m.attachments,
      senderId: m.senderId,
      senderName: m.sender.displayName,
      senderInitial: m.sender.displayName.charAt(0).toUpperCase(),
      isViewer: m.senderId === viewerId,
      createdAt: m.createdAt,
    })),
  };
}

/** Premier échange en cours avec conversation (démo sécurité C2C). */
export async function getDemoExchangeForSecurity(userId: string) {
  const ex = await prisma.exchange.findFirst({
    where: {
      OR: [{ initiatorId: userId }, { recipientId: userId }],
      status: { in: ["ACCEPTED", "AWAITING_SHIPMENT", "SHIPPED", "DELIVERED_WINDOW"] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { displayName: true, slug: true } },
      recipient: { select: { displayName: true, slug: true } },
      items: {
        include: {
          variant: { include: { card: true, versionType: true } },
        },
      },
    },
  });
  if (!ex) return null;

  const isInitiator = ex.initiatorId === userId;
  const partner = isInitiator ? ex.recipient : ex.initiator;

  return {
    id: ex.id,
    shortId: `#${ex.id.slice(-6).toUpperCase()}`,
    status: ex.status,
    secured: ex.secured,
    partnerName: partner.displayName,
    partnerSlug: partner.slug,
    viewerIsInitiator: isInitiator,
    itemCount: ex.items.length,
  };
}
