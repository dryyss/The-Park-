"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminExchangeRow, AdminSaleRow, AdminShipmentRow } from "@/server/admin/transactions-admin.service";
import { AdminFilterBar, AdminFilterCheckbox } from "@/components/admin/admin-filter-bar";

const SALE_STATUSES = [
  "PENDING_PAYMENT", "PAID", "AWAITING_SHIPMENT", "SHIPPED", "DELIVERED_WINDOW",
  "DELIVERED", "COMPLETED", "DISPUTED", "CANCELLED", "REFUNDED", "NOT_SHIPPED_CANCELLED",
] as const;

const EXCHANGE_STATUSES = [
  "PROPOSED", "ACCEPTED", "AWAITING_SHIPMENT", "SHIPPED", "DELIVERED_WINDOW",
  "DELIVERED", "COMPLETED", "DISPUTED", "CANCELLED", "NOT_SHIPPED_CANCELLED", "GUARANTEE_SUSPENDED",
] as const;

export function AdminTransactionsPanel({
  tab,
  sales,
  exchanges,
  shipments,
  stats,
  saleStatus,
  exchangeStatus,
  urgentOnly,
  query,
}: {
  tab: string;
  sales: { rows: AdminSaleRow[]; total: number; page: number; pageSize: number };
  exchanges: { rows: AdminExchangeRow[]; total: number; page: number; pageSize: number };
  shipments: { rows: AdminShipmentRow[]; total: number; page: number; pageSize: number };
  stats: { activeSales: number; activeExchanges: number; disputedSales: number; disputedExchanges: number; pendingShipments: number };
  saleStatus: string;
  exchangeStatus: string;
  urgentOnly: boolean;
  query: string;
}) {
  const t = useTranslations("admin.transactions");
  const router = useRouter();
  const activeTab = tab || "sales";
  const [q, setQ] = useState(query);
  const [saleSt, setSaleSt] = useState(saleStatus);
  const [exchangeSt, setExchangeSt] = useState(exchangeStatus);
  const [urgent, setUrgent] = useState(urgentOnly);

  function buildParams(extra?: Record<string, string>) {
    const sp = new URLSearchParams({ tab: activeTab, ...extra });
    if (q.trim()) sp.set("q", q.trim());
    if (activeTab === "sales" && saleSt) sp.set("saleStatus", saleSt);
    if (activeTab === "exchanges" && exchangeSt) sp.set("exchangeStatus", exchangeSt);
    if (activeTab === "shipments" && urgent) sp.set("urgent", "1");
    return sp.toString();
  }

  function applyFilters() {
    router.push(`/admin/transactions?${buildParams()}`);
  }

  function navigate(nextTab: string) {
    const sp = new URLSearchParams({ tab: nextTab });
    if (q.trim()) sp.set("q", q.trim());
    router.push(`/admin/transactions?${sp.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { key: "activeSales", value: stats.activeSales },
          { key: "activeExchanges", value: stats.activeExchanges },
          { key: "disputedSales", value: stats.disputedSales, alert: stats.disputedSales > 0 },
          { key: "disputedExchanges", value: stats.disputedExchanges, alert: stats.disputedExchanges > 0 },
          { key: "pendingShipments", value: stats.pendingShipments, alert: stats.pendingShipments > 0 },
        ].map((s) => (
          <div key={s.key} className={`rounded-[12px] border p-3 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
            <p className="text-texte-dim text-[9px] font-extrabold uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display text-blanc-casse mt-1 text-[22px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-charbon-500 pb-3">
        {(["sales", "exchanges", "shipments"] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => navigate(tabKey)}
            className={`rounded-lg px-4 py-2 text-[11px] font-extrabold uppercase ${activeTab === tabKey ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"}`}
          >
            {t(`tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      <AdminFilterBar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("searchPlaceholder")}
        onApply={applyFilters}
        onReset={() => {
          setQ("");
          setSaleSt("");
          setExchangeSt("");
          setUrgent(false);
          router.push(`/admin/transactions?tab=${activeTab}`);
        }}
      >
        {activeTab === "sales" && (
          <div className="min-w-[160px]">
            <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("colStatus")}</label>
            <select
              value={saleSt}
              onChange={(e) => setSaleSt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
            >
              <option value="" className="bg-charbon-800">{t("allStatuses")}</option>
              {SALE_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-charbon-800">{t(`saleStatuses.${s}`)}</option>
              ))}
            </select>
          </div>
        )}
        {activeTab === "exchanges" && (
          <div className="min-w-[160px]">
            <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("colStatus")}</label>
            <select
              value={exchangeSt}
              onChange={(e) => setExchangeSt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
            >
              <option value="" className="bg-charbon-800">{t("allStatuses")}</option>
              {EXCHANGE_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-charbon-800">{t(`exchangeStatuses.${s}`)}</option>
              ))}
            </select>
          </div>
        )}
        {activeTab === "shipments" && (
          <AdminFilterCheckbox label={t("urgentOnly")} checked={urgent} onChange={setUrgent} />
        )}
      </AdminFilterBar>

      {activeTab === "sales" && (
        <>
          <DataTable
            headers={[t("colCard"), t("colBuyer"), t("colSeller"), t("colPrice"), t("colStatus"), t("colSecured"), t("colDate")]}
            rows={sales.rows.map((s) => [
              s.cardName,
              s.buyerName,
              s.sellerName,
              s.price,
              t(`saleStatuses.${s.status}`),
              s.secured ? t("yes") : t("no"),
              s.createdAt.toISOString().slice(0, 10),
            ])}
            empty={t("emptySales")}
          />
        </>
      )}

      {activeTab === "exchanges" && (
        <>
          <DataTable
            headers={[t("colInitiator"), t("colRecipient"), t("colItems"), t("colStatus"), t("colSecured"), t("colDate")]}
            rows={exchanges.rows.map((e) => [
              e.initiatorName,
              e.recipientName,
              String(e.itemCount),
              t(`exchangeStatuses.${e.status}`),
              e.secured ? t("yes") : t("no"),
              e.createdAt.toISOString().slice(0, 10),
            ])}
            empty={t("emptyExchanges")}
          />
        </>
      )}

      {activeTab === "shipments" && (
        <>
          <DataTable
            headers={[t("colType"), t("colStatus"), t("colTracking"), t("colDeadline"), t("colSecured")]}
            rows={shipments.rows.map((s) => [
              s.type,
              s.status,
              s.trackingNumber ?? "—",
              s.notShipDeadline?.toISOString().slice(0, 16) ?? "—",
              s.secured ? t("yes") : t("no"),
            ])}
            empty={t("emptyShipments")}
          />
        </>
      )}
    </div>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
      <table className="w-full min-w-[700px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-charbon-600/50 hover:bg-charbon-700/40">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "font-extrabold text-blanc-casse" : "text-texte-dim"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{empty}</p>}
    </div>
  );
}
