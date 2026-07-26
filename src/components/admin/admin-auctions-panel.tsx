"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminAuctionRow } from "@/server/admin/auctions-admin.service";
import {
  adminCancelAuctionAction,
  adminRefundAuctionOptionAction,
} from "@/server/admin/admin.actions";

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
  stats: {
    active: number;
    scheduled: number;
    closed: number;
    reported: number;
    optionsSold: number;
    optionsRevenue: string;
  };
  query: string;
  status: string;
}) {
  const t = useTranslations("admin.auctions");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [st, setSt] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Une seule enchère dépliée à la fois : le tableau reste lisible.
  const [openOptions, setOpenOptions] = useState<string | null>(null);
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

  function refundOption(optionId: string, userName: string) {
    if (!confirm(t("confirmRefundOption", { name: userName }))) return;
    setError(null);
    startTransition(async () => {
      const res = await adminRefundAuctionOptionAction(optionId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { key: "active", value: stats.active },
          { key: "scheduled", value: stats.scheduled },
          { key: "closed", value: stats.closed },
          { key: "reported", value: stats.reported, alert: stats.reported > 0 },
          { key: "optionsSold", value: stats.optionsSold },
          { key: "optionsRevenue", value: stats.optionsRevenue },
        ].map((s) => (
          <div
            key={s.key}
            className={`rounded-[12px] border p-4 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
          >
            <p className="text-texte-dim text-[10px] font-extrabold uppercase">
              {t(`stats.${s.key}`)}
            </p>
            <p className="font-display text-blanc-casse mt-1 text-[24px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder={t("searchPlaceholder")}
            className="border-charbon-500 bg-charbon-700 text-blanc-casse focus:border-carmin w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
          />
        </div>
        <select
          value={st}
          onChange={(e) => setSt(e.target.value)}
          className="border-charbon-500 bg-charbon-700 text-blanc-casse rounded-lg border px-3 py-2 text-[13px]"
        >
          <option value="">{t("all")}</option>
          {AUCTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => applyFilters()}
          className="bg-carmin rounded-lg px-4 py-2 text-[12px] font-extrabold text-white uppercase"
        >
          {t("filter")}
        </button>
      </div>

      {error && <p className="text-neon-rouge text-[13px] font-bold">{error}</p>}

      <div className="border-charbon-500 bg-charbon-800 overflow-x-auto rounded-[16px] border">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-charbon-500 text-texte-dim border-b text-[11px] font-extrabold tracking-wide uppercase">
              <th className="px-4 py-3">{t("colCard")}</th>
              <th className="px-4 py-3">{t("colSeller")}</th>
              <th className="px-4 py-3">{t("colCurrent")}</th>
              <th className="px-4 py-3">{t("colBids")}</th>
              <th className="px-4 py-3">{t("colOptions")}</th>
              <th className="px-4 py-3">{t("colStatus")}</th>
              <th className="px-4 py-3">{t("colEnds")}</th>
              <th className="px-4 py-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row) => [
              <tr key={row.id} className="border-charbon-600/50 hover:bg-charbon-700/40 border-b">
                <td className="text-blanc-casse px-4 py-3 font-extrabold">
                  #{row.cardNumber} {row.cardName}
                </td>
                <td className="text-carmin px-4 py-3">{row.sellerName}</td>
                <td className="text-or px-4 py-3">{row.currentPrice}</td>
                <td className="px-4 py-3">{row.bidCount}</td>
                <td className="px-4 py-3">
                  {row.options.length === 0 ? (
                    <span className="text-texte-faible">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenOptions((v) => (v === row.id ? null : row.id))}
                      aria-expanded={openOptions === row.id}
                      className="text-or text-[12px] font-extrabold hover:underline"
                    >
                      {row.options.length} · {row.optionRevenue}{" "}
                      {openOptions === row.id ? "▾" : "▸"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">{t(`statuses.${row.status}`)}</td>
                <td className="text-texte-dim px-4 py-3 text-[12px]">
                  {row.endsAt.toISOString().slice(0, 16)}
                </td>
                <td className="px-4 py-3">
                  {(row.status === "ACTIVE" || row.status === "SCHEDULED") && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cancel(row.id)}
                      className="border-neon-rouge/50 text-neon-rouge rounded-md border px-2 py-1 text-[10px] font-extrabold uppercase disabled:opacity-50"
                    >
                      {t("cancel")}
                    </button>
                  )}
                  {row.winnerName && (
                    <span className="text-texte-dim text-[11px]">
                      {t("winner")}: {row.winnerName}
                    </span>
                  )}
                </td>
              </tr>,
              // Dépliage juste sous sa propre enchère, d'où le flatMap plutôt que
              // deux boucles successives.
              ...(openOptions === row.id
                ? [
                    <tr key={`${row.id}-options`} className="bg-charbon-900/40">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="text-texte-dim mb-2 text-[10px] font-extrabold tracking-wide uppercase">
                          {t("optionsTitle")}
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {row.options.map((opt) => (
                            <li
                              key={opt.id}
                              className="bg-charbon-800 flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-[12px]"
                            >
                              <span className="text-blanc-casse font-bold">{opt.userName}</span>
                              <span className="text-or font-mono">{opt.feePaid}</span>
                              {opt.refunded ? (
                                <span className="text-texte-faible text-[10.5px] font-extrabold uppercase">
                                  {t("optionRefunded")}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => refundOption(opt.id, opt.userName)}
                                  className="border-neon-rouge/50 text-neon-rouge ml-auto rounded-md border px-2 py-1 text-[10px] font-extrabold uppercase disabled:opacity-50"
                                >
                                  {t("optionRefund")}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>,
                  ]
                : []),
            ])}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-texte-dim p-8 text-center text-[13px] font-bold">{t("empty")}</p>
        )}
      </div>

      <div className="text-texte-dim flex items-center justify-between text-[12px] font-bold">
        <span>{t("total", { count: total })}</span>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => applyFilters(page - 1)}
            className="border-charbon-500 rounded-lg border px-3 py-1.5 uppercase disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <span>{t("pageOf", { page, total: totalPages })}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => applyFilters(page + 1)}
            className="border-charbon-500 rounded-lg border px-3 py-1.5 uppercase disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
