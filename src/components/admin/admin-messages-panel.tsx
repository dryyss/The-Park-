"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { AdminConversationRow } from "@/server/admin/messages-admin.service";

export function AdminMessagesPanel({
  result,
  stats,
  query,
  flaggedOnly,
}: {
  result: { rows: AdminConversationRow[]; total: number; page: number; pageSize: number };
  stats: { total: number; flagged: number; minorThreads: number };
  query: string;
  flaggedOnly: boolean;
}) {
  const t = useTranslations("admin.messages");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function applyFilters(page = 1, flagged = flaggedOnly) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (flagged) sp.set("flagged", "1");
    if (page > 1) sp.set("page", String(page));
    router.push(`/admin/messages${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { key: "total", value: stats.total },
          { key: "flagged", value: stats.flagged, alert: stats.flagged > 0 },
          { key: "minorThreads", value: stats.minorThreads },
        ].map((s) => (
          <div key={s.key} className={`rounded-[12px] border p-4 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
            <p className="text-texte-dim text-[10px] font-extrabold uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display text-blanc-casse mt-1 text-[24px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} placeholder={t("searchPlaceholder")} className="min-w-[200px] flex-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
        <label className="flex items-center gap-2 text-[12px] font-bold text-texte-dim">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => applyFilters(1, e.target.checked)} />
          {t("flaggedOnly")}
        </label>
        <button type="button" onClick={() => applyFilters()} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase">{t("filter")}</button>
      </div>

      <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
        <table className="w-full min-w-[800px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("colContext")}</th>
              <th className="px-4 py-3">{t("colParticipants")}</th>
              <th className="px-4 py-3">{t("colMessages")}</th>
              <th className="px-4 py-3">{t("colLast")}</th>
              <th className="px-4 py-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className={`border-b border-charbon-600/50 hover:bg-charbon-700/40 ${row.involvesMinor ? "bg-charbon-700/30" : ""}`}>
                <td className="px-4 py-3">
                  <span className="font-extrabold text-blanc-casse">{t(`contexts.${row.context}`)}</span>
                  {row.reportCount > 0 && <span className="text-neon-orange ml-2 text-[10px] font-extrabold">({row.reportCount})</span>}
                </td>
                <td className="px-4 py-3 text-texte-dim">{row.participantNames.join(" · ")}</td>
                <td className="px-4 py-3">{row.messageCount}</td>
                <td className="px-4 py-3 text-[12px] text-texte-dim">
                  {row.lastPreview && <span className="block truncate max-w-[200px]">{row.lastPreview}</span>}
                  {row.lastMessageAt && <span className="text-texte-faible">{row.lastMessageAt.toISOString().slice(0, 16)}</span>}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/messages/${row.id}`} className="text-[11px] font-extrabold text-carmin uppercase hover:underline">{t("open")}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>}
      </div>

      <div className="flex items-center justify-between text-[12px] font-bold text-texte-dim">
        <span>{t("total", { count: result.total })}</span>
        <div className="flex gap-3">
          <button type="button" disabled={result.page <= 1} onClick={() => applyFilters(result.page - 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("prev")}</button>
          <span>{t("pageOf", { page: result.page, total: totalPages })}</span>
          <button type="button" disabled={result.page >= totalPages} onClick={() => applyFilters(result.page + 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("next")}</button>
        </div>
      </div>
    </div>
  );
}
