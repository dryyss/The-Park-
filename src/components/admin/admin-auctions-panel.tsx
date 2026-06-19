"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminAuctionRow } from "@/server/admin/auctions-admin.service";
import { adminCancelAuctionAction } from "@/server/admin/admin.actions";

const AUCTION_STATUSES = ["SCHEDULED", "ACTIVE", "CLOSED", "SOLD", "CANCELLED"] as const;

export function AdminAuctionsPanel({
  rows,
  total,
  page,
  pageSize,
  stats,
  query,
  status,
}: {
  rows: AdminAuctionRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { active: number; scheduled: number; closed: number; reported: number };
  query: string;
  status: string;
}) {
  const t = useTranslations("admin.auctions");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [st, setSt] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyFilters(nextPage = 1) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (st) sp.set("status", st);
    if (nextPage > 1) sp.set("page", String(nextPage));
    router.push(`/admin/encheres${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function cancel(auctionId: string) {
    if (!confirm(t("confirmCancel"))) return;
    setError(null);
    startTransition(async () => {
      const res = await adminCancelAuctionAction(auctionId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { key: "active", value: stats.active },
          { key: "scheduled", value: stats.scheduled },
          { key: "closed", value: stats.closed },
          { key: "reported", value: stats.reported, alert: stats.reported > 0 },
        ].map((s) => (
          <div key={s.key} className={`rounded-[12px] border p-4 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
            <p className="text-texte-dim text-[10px] font-extrabold uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display text-blanc-casse mt-1 text-[24px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} placeholder={t("searchPlaceholder")} className="w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin" />
        </div>
        <select value={st} onChange={(e) => setSt(e.target.value)} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
          <option value="">{t("all")}</option>
          {AUCTION_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`statuses.${s}`)}</option>
          ))}
        </select>
        <button type="button" onClick={() => applyFilters()} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase">{t("filter")}</button>
      </div>

      {error && <p className="text-[13px] font-bold text-neon-rouge">{error}</p>}

      <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("colCard")}</th>
              <th className="px-4 py-3">{t("colSeller")}</th>
              <th className="px-4 py-3">{t("colCurrent")}</th>
              <th className="px-4 py-3">{t("colBids")}</th>
              <th className="px-4 py-3">{t("colStatus")}</th>
              <th className="px-4 py-3">{t("colEnds")}</th>
              <th className="px-4 py-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-charbon-600/50 hover:bg-charbon-700/40">
                <td className="px-4 py-3 font-extrabold text-blanc-casse">#{row.cardNumber} {row.cardName}</td>
                <td className="px-4 py-3 text-carmin">{row.sellerName}</td>
                <td className="px-4 py-3 text-or">{row.currentPrice}</td>
                <td className="px-4 py-3">{row.bidCount}</td>
                <td className="px-4 py-3">{t(`statuses.${row.status}`)}</td>
                <td className="px-4 py-3 text-[12px] text-texte-dim">{row.endsAt.toISOString().slice(0, 16)}</td>
                <td className="px-4 py-3">
                  {(row.status === "ACTIVE" || row.status === "SCHEDULED") && (
                    <button type="button" disabled={pending} onClick={() => cancel(row.id)} className="rounded-md border border-neon-rouge/50 px-2 py-1 text-[10px] font-extrabold text-neon-rouge uppercase disabled:opacity-50">
                      {t("cancel")}
                    </button>
                  )}
                  {row.winnerName && <span className="text-[11px] text-texte-dim">{t("winner")}: {row.winnerName}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>}
      </div>

      <div className="flex items-center justify-between text-[12px] font-bold text-texte-dim">
        <span>{t("total", { count: total })}</span>
        <div className="flex gap-3">
          <button type="button" disabled={page <= 1} onClick={() => applyFilters(page - 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("prev")}</button>
          <span>{t("pageOf", { page, total: totalPages })}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => applyFilters(page + 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("next")}</button>
        </div>
      </div>
    </div>
  );
}
