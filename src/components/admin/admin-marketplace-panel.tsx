"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { AdminListingListResult } from "@/server/admin/marketplace-admin.service";
import { adminModerateListingAction } from "@/server/admin/admin.actions";

const LISTING_STATUSES = ["ACTIVE", "PAUSED", "SOLD", "CANCELLED", "EXPIRED", "DRAFT"] as const;
const LISTING_TYPES = ["SELL", "TRADE", "SELL_OR_TRADE", "WANT"] as const;

export function AdminMarketplacePanel({
  result,
  stats,
  query,
  status,
  type,
}: {
  result: AdminListingListResult;
  stats: { active: number; paused: number; want: number; reported: number };
  query: string;
  status: string;
  type: string;
}) {
  const t = useTranslations("admin.marketplace");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [st, setSt] = useState(status);
  const [ty, setTy] = useState(type);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function applyFilters(page = 1) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (st) sp.set("status", st);
    if (ty) sp.set("type", ty);
    if (page > 1) sp.set("page", String(page));
    router.push(`/admin/marketplace${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function moderate(listingId: string, action: "PAUSE" | "CANCEL" | "ACTIVATE") {
    setError(null);
    startTransition(async () => {
      const res = await adminModerateListingAction({ listingId, action });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { key: "active", value: stats.active },
          { key: "paused", value: stats.paused },
          { key: "want", value: stats.want },
          { key: "reported", value: stats.reported, alert: stats.reported > 0 },
        ].map((s) => (
          <div
            key={s.key}
            className={`rounded-[12px] border p-4 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
          >
            <p className="text-texte-dim text-[10px] font-extrabold uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display text-blanc-casse mt-1 text-[24px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("search")}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder={t("searchPlaceholder")}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("statusFilter")}</label>
          <select value={st} onChange={(e) => setSt(e.target.value)} className="mt-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
            <option value="">{t("all")}</option>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`statuses.${s}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("typeFilter")}</label>
          <select value={ty} onChange={(e) => setTy(e.target.value)} className="mt-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
            <option value="">{t("all")}</option>
            {LISTING_TYPES.map((s) => (
              <option key={s} value={s}>{t(`types.${s}`)}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => applyFilters()} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase">
          {t("filter")}
        </button>
      </div>

      {error && <p className="text-[13px] font-bold text-neon-rouge">{error}</p>}

      <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("colCard")}</th>
              <th className="px-4 py-3">{t("colSeller")}</th>
              <th className="px-4 py-3">{t("colType")}</th>
              <th className="px-4 py-3">{t("colPrice")}</th>
              <th className="px-4 py-3">{t("colStatus")}</th>
              <th className="px-4 py-3">{t("colReports")}</th>
              <th className="px-4 py-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className="border-b border-charbon-600/50 hover:bg-charbon-700/40">
                <td className="px-4 py-3">
                  <span className="font-extrabold text-blanc-casse">#{row.cardNumber} {row.cardName}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/utilisateurs/${row.sellerId}`} className="text-carmin hover:underline">
                    {row.sellerName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[12px]">{t(`types.${row.type}`)}</td>
                <td className="px-4 py-3 text-or">{row.price ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-charbon-600 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                    {t(`statuses.${row.status}`)}
                  </span>
                </td>
                <td className={`px-4 py-3 font-bold ${row.reportCount > 0 ? "text-neon-orange" : "text-texte-dim"}`}>
                  {row.reportCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {row.status === "ACTIVE" && (
                      <ActionBtn disabled={pending} onClick={() => moderate(row.id, "PAUSE")} label={t("pause")} />
                    )}
                    {row.status === "PAUSED" && (
                      <ActionBtn disabled={pending} onClick={() => moderate(row.id, "ACTIVATE")} label={t("activate")} />
                    )}
                    {row.status !== "CANCELLED" && row.status !== "SOLD" && (
                      <ActionBtn disabled={pending} onClick={() => moderate(row.id, "CANCEL")} label={t("cancel")} danger />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>}
      </div>

      <Pagination total={result.total} page={result.page} totalPages={totalPages} onPage={applyFilters} t={t} />
    </div>
  );
}

function ActionBtn({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[10px] font-extrabold uppercase disabled:opacity-50 ${danger ? "border-neon-rouge/50 text-neon-rouge" : "border-charbon-400 text-texte-dim hover:border-carmin hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function Pagination({
  total,
  page,
  totalPages,
  onPage,
  t,
}: {
  total: number;
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center justify-between text-[12px] font-bold text-texte-dim">
      <span>{t("total", { count: total })}</span>
      <div className="flex items-center gap-3">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("prev")}</button>
        <span>{t("pageOf", { page, total: totalPages })}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("next")}</button>
      </div>
    </div>
  );
}
