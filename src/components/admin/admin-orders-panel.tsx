"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { AdminOrderListResult, AdminOrderRow, AdminOrderStats } from "@/server/admin/orders.service";
import { updateOrderStatusAction } from "@/server/admin/shop.actions";

const STATUSES = ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
const PERIODS = ["", "today", "week", "month"] as const;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-charbon-600 text-texte-dim",
  PAID: "bg-neon-vert/15 text-neon-vert",
  PREPARING: "bg-neon-orange/15 text-neon-orange",
  SHIPPED: "bg-carmin/15 text-carmin",
  DELIVERED: "bg-neon-vert/15 text-neon-vert",
  CANCELLED: "bg-charbon-600 text-texte-faible",
  REFUNDED: "bg-neon-rouge/15 text-neon-rouge",
};

export function AdminOrdersPanel({
  result,
  stats,
  query,
  status,
  period,
}: {
  result: AdminOrderListResult;
  stats: AdminOrderStats;
  query: string;
  status: string;
  period: string;
}) {
  const t = useTranslations("admin.orders");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [st, setSt] = useState(status);
  const [pr, setPr] = useState(period);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function applyFilters(nextPage = 1) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (st) sp.set("status", st);
    if (pr) sp.set("period", pr);
    if (nextPage > 1) sp.set("page", String(nextPage));
    router.push(`/admin/commandes${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function updateStatus(orderId: string, nextStatus: (typeof STATUSES)[number]) {
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatusAction({ orderId, status: nextStatus });
      if (res.ok) router.refresh();
      else setError(t("errUpdate"));
    });
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label={t("statsTotal")} value={String(stats.total)} />
        <StatTile label={t("statsToShip")} value={String(stats.toShip)} alert={stats.toShip > 0} />
        <StatTile label={t("statsToday")} value={String(stats.todayCount)} />
        <StatTile label={t("statsRevenueToday")} value={stats.revenueToday} highlight />
        <StatTile label={t("statsRevenueMonth")} value={stats.revenueMonth} highlight />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("search")}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder={t("searchPlaceholder")}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
        </div>
        <div>
          <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("statusFilter")}</label>
          <select
            value={st}
            onChange={(e) => setSt(e.target.value)}
            className="mt-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          >
            <option value="" className="bg-charbon-800">{t("statusAll")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-charbon-800">{t(`statuses.${s}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("periodFilter")}</label>
          <select
            value={pr}
            onChange={(e) => setPr(e.target.value)}
            className="mt-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          >
            {PERIODS.map((p) => (
              <option key={p || "all"} value={p} className="bg-charbon-800">
                {p ? t(`periods.${p}`) : t("periodAll")}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => applyFilters()}
          className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase"
        >
          {t("filter")}
        </button>
      </div>

      {error && <p className="mb-3 text-[13px] font-bold text-neon-rouge">{error}</p>}

      <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("number")}</th>
              <th className="px-4 py-3">{t("customer")}</th>
              <th className="px-4 py-3">{t("total")}</th>
              <th className="px-4 py-3">{t("items")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("payment")}</th>
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[13px] font-bold text-texte-faible">{t("empty")}</td>
              </tr>
            ) : (
              result.rows.map((o) => (
                <OrderRow key={o.id} order={o} pending={pending} onStatusChange={updateStatus} t={t} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px] font-bold text-texte-dim">
        <span>{t("totalCount", { count: result.total })}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={result.page <= 1}
            onClick={() => applyFilters(result.page - 1)}
            className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <span>{t("pageOf", { page: result.page, total: totalPages })}</span>
          <button
            type="button"
            disabled={result.page >= totalPages}
            onClick={() => applyFilters(result.page + 1)}
            className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, alert, highlight }: { label: string; value: string; alert?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-[10px] border px-4 py-3 ${alert ? "border-neon-orange/40 bg-neon-orange/5" : "border-charbon-500 bg-charbon-800"}`}>
      <p className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{label}</p>
      <p className={`mt-1 font-display text-[20px] ${highlight ? "text-or" : "text-blanc-casse"}`}>{value}</p>
    </div>
  );
}

function OrderRow({
  order,
  pending,
  onStatusChange,
  t,
}: {
  order: AdminOrderRow;
  pending: boolean;
  onStatusChange: (id: string, status: (typeof STATUSES)[number]) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <tr className="border-b border-charbon-600/50 hover:bg-charbon-700/30">
      <td className="px-4 py-3">
        <Link href={`/admin/commandes/${order.id}`} className="font-mono text-[12px] text-or hover:underline">
          {order.orderNumber}
        </Link>
        {order.trackingNumber && (
          <p className="mt-0.5 font-mono text-[10px] text-texte-faible">{order.trackingNumber}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <Link href={`/admin/utilisateurs/${order.customerId}`} className="font-extrabold text-blanc-casse hover:text-carmin">
          {order.customerName}
        </Link>
      </td>
      <td className="px-4 py-3 text-or">{order.total}</td>
      <td className="px-4 py-3">{order.itemCount}</td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_STYLE[order.status] ?? "bg-charbon-600 text-texte-dim"}`}>
          {t(`statuses.${order.status}`)}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] font-bold text-texte-dim">
        {order.paymentStatus ? t(`paymentStatuses.${order.paymentStatus}`) : "—"}
      </td>
      <td className="px-4 py-3 text-[12px] text-texte-dim">
        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(order.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            defaultValue={order.status}
            disabled={pending}
            onChange={(e) => onStatusChange(order.id, e.target.value as (typeof STATUSES)[number])}
            className="rounded border border-charbon-500 bg-charbon-700 px-2 py-1 text-[11px]"
            aria-label={t("changeStatus")}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`statuses.${s}`)}</option>
            ))}
          </select>
          <Link
            href={`/admin/commandes/${order.id}`}
            className="rounded border border-charbon-500 px-2 py-1 text-[11px] font-extrabold text-carmin uppercase hover:bg-carmin/10"
          >
            {t("view")}
          </Link>
        </div>
      </td>
    </tr>
  );
}
