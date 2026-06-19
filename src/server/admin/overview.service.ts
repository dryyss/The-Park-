import "server-only";
import { prisma } from "@/lib/prisma";
import type { AdminModule } from "@/server/auth/roles.definition";

export interface AdminPerspectiveStats {
  key: string;
  value: number;
  alert?: boolean;
}

export interface AdminPerspective {
  key: "community" | "marketplace" | "c2c" | "moderation" | "shop" | "catalog" | "finance";
  stats: AdminPerspectiveStats[];
  href: string;
  module: AdminModule;
}

export interface AdminActionItem {
  id: string;
  kind:
    | "REPORT"
    | "DISPUTE"
    | "ORDER"
    | "SHIPMENT_DEADLINE"
    | "LOW_STOCK"
    | "PARENTAL_CONSENT"
    | "SALE"
    | "EXCHANGE";
  title: string;
  subtitle: string;
  priority: number;
  involvesMinor: boolean;
  href: string;
  createdAt: Date;
}

export interface AdminDashboardData {
  perspectives: AdminPerspective[];
  actionQueue: AdminActionItem[];
}

const ACTIVE_SALE = [
  "PAID",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "DELIVERED_WINDOW",
  "DELIVERED",
  "DISPUTED",
] as const;

const ACTIVE_EXCHANGE = [
  "ACCEPTED",
  "AWAITING_SHIPMENT",
  "SHIPPED",
  "DELIVERED_WINDOW",
  "DELIVERED",
  "GUARANTEE_SUSPENDED",
  "DISPUTED",
] as const;

export async function getAdminDashboardData(accessibleModules: AdminModule[]): Promise<AdminDashboardData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const shipDeadlineSoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const eighteenYearsAgo = new Date(now);
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

  const [
    members,
    minors,
    pendingConsents,
    activeListings,
    wantListings,
    activeAuctions,
    activeSales,
    activeExchanges,
    openDisputes,
    pendingReports,
    shopProducts,
    lowStock,
    ordersPending,
    cards,
    seasons,
    communityPhotos,
    paymentsPending,
    walletAccounts,
    newMembersWeek,
    urgentShipments,
    topReports,
    topDisputes,
    pendingOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "MEMBER", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "MEMBER", status: "ACTIVE", birthDate: { gt: eighteenYearsAgo } } }),
    prisma.parentalConsent.count({ where: { verifiedAt: null } }),
    prisma.listing.count({ where: { status: "ACTIVE", type: { not: "WANT" } } }),
    prisma.listing.count({ where: { status: "ACTIVE", type: "WANT" } }),
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.sale.count({ where: { status: { in: [...ACTIVE_SALE] } } }),
    prisma.exchange.count({ where: { status: { in: [...ACTIVE_EXCHANGE] } } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_EVIDENCE"] } } }),
    prisma.report.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, stock: { lte: 5 } } }),
    prisma.order.count({ where: { status: { in: ["PENDING", "PAID", "PREPARING"] } } }),
    prisma.card.count(),
    prisma.season.count(),
    prisma.collectionItemPhoto.count(),
    prisma.payment.count({ where: { status: { in: ["REQUIRES_PAYMENT", "AUTHORIZED"] } } }),
    prisma.walletAccount.count({ where: { OR: [{ depositBalance: { gt: 0 } }, { earnedBalance: { gt: 0 } }] } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo }, role: "MEMBER" } }),
    prisma.shipment.count({
      where: {
        status: "PENDING",
        notShipDeadline: { lte: shipDeadlineSoon, gte: now },
      },
    }),
    prisma.report.findMany({
      where: { status: { in: ["PENDING", "REVIEWING"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 8,
      include: { reporter: { select: { displayName: true } } },
    }),
    prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_EVIDENCE"] } },
      orderBy: [{ priority: "desc" }, { openedAt: "asc" }],
      take: 8,
      include: {
        claimant: { select: { displayName: true } },
        respondent: { select: { displayName: true } },
      },
    }),
    prisma.order.findMany({
      where: { status: { in: ["PENDING", "PAID", "PREPARING"] } },
      orderBy: { createdAt: "asc" },
      take: 5,
      include: { user: { select: { displayName: true } } },
    }),
  ]);

  const allPerspectives: AdminPerspective[] = [
    {
      key: "community",
      module: "users",
      href: "/admin/utilisateurs",
      stats: [
        { key: "members", value: members },
        { key: "newMembersWeek", value: newMembersWeek },
        { key: "minors", value: minors },
        { key: "pendingConsents", value: pendingConsents, alert: pendingConsents > 0 },
      ],
    },
    {
      key: "marketplace",
      module: "marketplace",
      href: "/admin/marketplace",
      stats: [
        { key: "activeListings", value: activeListings },
        { key: "wantListings", value: wantListings },
        { key: "activeAuctions", value: activeAuctions },
      ],
    },
    {
      key: "c2c",
      module: "transactions",
      href: "/admin/transactions",
      stats: [
        { key: "activeSales", value: activeSales },
        { key: "activeExchanges", value: activeExchanges },
        { key: "urgentShipments", value: urgentShipments, alert: urgentShipments > 0 },
      ],
    },
    {
      key: "moderation",
      module: "moderation",
      href: "/admin/moderation",
      stats: [
        { key: "pendingReports", value: pendingReports, alert: pendingReports > 0 },
        { key: "openDisputes", value: openDisputes, alert: openDisputes > 0 },
      ],
    },
    {
      key: "shop",
      module: "shop",
      href: "/admin/boutique",
      stats: [
        { key: "shopProducts", value: shopProducts },
        { key: "lowStock", value: lowStock, alert: lowStock > 0 },
        { key: "ordersPending", value: ordersPending, alert: ordersPending > 0 },
      ],
    },
    {
      key: "catalog",
      module: "catalog",
      href: "/admin/catalogue",
      stats: [
        { key: "cards", value: cards },
        { key: "seasons", value: seasons },
        { key: "communityPhotos", value: communityPhotos },
      ],
    },
    {
      key: "finance",
      module: "finance",
      href: "/admin/finances",
      stats: [
        { key: "paymentsPending", value: paymentsPending, alert: paymentsPending > 0 },
        { key: "walletAccounts", value: walletAccounts },
      ],
    },
  ];

  const perspectives = allPerspectives.filter((p) => accessibleModules.includes(p.module));

  const actionQueue: AdminActionItem[] = [];

  for (const r of topReports) {
    actionQueue.push({
      id: `report-${r.id}`,
      kind: "REPORT",
      title: `${r.targetType} · ${r.reporter.displayName}`,
      subtitle: r.reason.slice(0, 120),
      priority: r.priority + (r.involvesMinor ? 1000 : 0),
      involvesMinor: r.involvesMinor,
      href: "/admin/moderation",
      createdAt: r.createdAt,
    });
  }

  for (const d of topDisputes) {
    actionQueue.push({
      id: `dispute-${d.id}`,
      kind: "DISPUTE",
      title: `${d.type} · ${d.claimant.displayName} vs ${d.respondent.displayName}`,
      subtitle: d.reason.slice(0, 120),
      priority: d.priority + (d.involvesMinor ? 1000 : 0) + 50,
      involvesMinor: d.involvesMinor,
      href: `/admin/moderation/litiges/${d.id}`,
      createdAt: d.openedAt,
    });
  }

  for (const o of pendingOrders) {
    actionQueue.push({
      id: `order-${o.id}`,
      kind: "ORDER",
      title: o.orderNumber,
      subtitle: o.user.displayName,
      priority: 10,
      involvesMinor: false,
      href: "/admin/commandes",
      createdAt: o.createdAt,
    });
  }

  if (urgentShipments > 0 && accessibleModules.includes("transactions")) {
    actionQueue.push({
      id: "shipments-urgent",
      kind: "SHIPMENT_DEADLINE",
      title: `${urgentShipments} envoi(s)`,
      subtitle: "Deadline expédition < 24 h",
      priority: 200,
      involvesMinor: false,
      href: "/admin/transactions?tab=shipments",
      createdAt: now,
    });
  }

  if (lowStock > 0 && accessibleModules.includes("shop")) {
    actionQueue.push({
      id: "low-stock",
      kind: "LOW_STOCK",
      title: `${lowStock} produit(s)`,
      subtitle: "Stock ≤ 5 unités",
      priority: 30,
      involvesMinor: false,
      href: "/admin/boutique",
      createdAt: now,
    });
  }

  if (pendingConsents > 0 && accessibleModules.includes("users")) {
    actionQueue.push({
      id: "parental-consents",
      kind: "PARENTAL_CONSENT",
      title: `${pendingConsents} consentement(s)`,
      subtitle: "Consentements parentaux en attente",
      priority: 500,
      involvesMinor: true,
      href: "/admin/utilisateurs?status=PENDING_VERIFICATION",
      createdAt: now,
    });
  }

  actionQueue.sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());

  return { perspectives, actionQueue: actionQueue.slice(0, 15) };
}

export interface AdminChartPoint {
  date: string;
  members: number;
  orders: number;
  sales: number;
  listings: number;
}

/** Séries sur 14 jours pour les graphiques overview. */
export async function getAdminChartSeries(): Promise<AdminChartPoint[]> {
  const days = 14;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [users, orders, sales, listings] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: start }, role: "MEMBER" },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.listing.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, AdminChartPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, members: 0, orders: 0, sales: 0, listings: 0 });
  }

  function bump(items: { createdAt: Date }[], field: keyof Omit<AdminChartPoint, "date">) {
    for (const item of items) {
      const key = item.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) b[field] += 1;
    }
  }

  bump(users, "members");
  bump(orders, "orders");
  bump(sales, "sales");
  bump(listings, "listings");

  return [...buckets.values()];
}
