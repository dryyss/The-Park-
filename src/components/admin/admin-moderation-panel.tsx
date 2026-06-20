"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { ModerationDisputeRow, ModerationReportRow } from "@/server/moderation/moderation.service";
import { resolveReportAction, updateDisputeStatusAction } from "@/server/moderation/moderation.actions";
import { AdminFilterBar, AdminFilterCheckbox, AdminFilterSelect, matchAdminSearch } from "@/components/admin/admin-filter-bar";

export function AdminModerationPanel({
  reports,
  disputes,
}: {
  reports: ModerationReportRow[];
  disputes: ModerationDisputeRow[];
}) {
  const t = useTranslations("admin.moderation");
  const tFilters = useTranslations("admin.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [minorOnly, setMinorOnly] = useState(false);

  const reportTargets = useMemo(
    () => [...new Set(reports.map((r) => r.targetType))].sort(),
    [reports],
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((r) => {
        if (minorOnly && !r.involvesMinor) return false;
        if (targetFilter && r.targetType !== targetFilter) return false;
        return matchAdminSearch(q, r.reporterName, r.reason, r.targetType);
      }),
    [reports, q, targetFilter, minorOnly],
  );

  const filteredDisputes = useMemo(
    () =>
      disputes.filter((d) => {
        if (minorOnly && !d.involvesMinor) return false;
        return matchAdminSearch(q, d.claimantName, d.respondentName, d.reason, d.type);
      }),
    [disputes, q, minorOnly],
  );

  const hasFilters = Boolean(q.trim() || targetFilter || minorOnly);

  function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
    startTransition(async () => {
      await resolveReportAction(id, status);
      router.refresh();
    });
  }

  function updateDispute(id: string, status: "UNDER_REVIEW" | "RESOLVED" | "CLOSED") {
    startTransition(async () => {
      await updateDisputeStatusAction(id, status);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <AdminFilterBar
        live
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("searchPlaceholder")}
        onReset={hasFilters ? () => { setQ(""); setTargetFilter(""); setMinorOnly(false); } : undefined}
      >
        <AdminFilterSelect
          label={t("filterTarget")}
          value={targetFilter}
          onChange={setTargetFilter}
          options={[
            { value: "", label: t("targetAll") },
            ...reportTargets.map((target) => ({ value: target, label: target })),
          ]}
        />
        <AdminFilterCheckbox label={t("filterMinor")} checked={minorOnly} onChange={setMinorOnly} />
      </AdminFilterBar>

      {hasFilters && (
        <p className="text-[12px] font-bold text-texte-faible">
          {tFilters("resultsCount", { count: filteredReports.length + filteredDisputes.length })}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="font-display mb-4 text-[18px] text-blanc-casse uppercase">{t("reports")}</h2>
        <div className="flex flex-col gap-3">
          {filteredReports.map((r) => (
            <div key={r.id} className={`rounded-[14px] border p-4 ${r.involvesMinor ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
              <p className="text-[12px] font-extrabold text-blanc-casse">
                {r.targetType} · {r.reporterName}
              </p>
              <p className="mt-1 text-[13px] text-texte-dim">{r.reason}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={pending} onClick={() => resolveReport(r.id, "RESOLVED")} className="rounded bg-statut-succes/20 px-3 py-1 text-[11px] font-extrabold text-statut-succes">
                  {t("resolve")}
                </button>
                <button type="button" disabled={pending} onClick={() => resolveReport(r.id, "DISMISSED")} className="rounded bg-charbon-600 px-3 py-1 text-[11px] font-extrabold text-texte-dim">
                  {t("dismiss")}
                </button>
              </div>
            </div>
          ))}
          {filteredReports.length === 0 && (
            <p className="text-[13px] text-texte-dim">{hasFilters ? tFilters("noResults") : t("noReports")}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display mb-4 text-[18px] text-blanc-casse uppercase">{t("disputes")}</h2>
        <div className="flex flex-col gap-3">
          {filteredDisputes.map((d) => (
            <div key={d.id} className={`rounded-[14px] border p-4 ${d.involvesMinor ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
              <p className="text-[12px] font-extrabold text-blanc-casse">
                {d.type} · {d.claimantName} vs {d.respondentName}
              </p>
              <p className="mt-1 text-[13px] text-texte-dim">{d.reason}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/admin/moderation/litiges/${d.id}`} className="rounded bg-carmin/20 px-3 py-1 text-[11px] font-extrabold text-carmin uppercase hover:bg-carmin hover:text-white">
                  {t("openDispute")}
                </Link>
                <select
                defaultValue={d.status}
                disabled={pending}
                onChange={(e) => updateDispute(d.id, e.target.value as "UNDER_REVIEW" | "RESOLVED" | "CLOSED")}
                className="mt-3 rounded border border-charbon-500 bg-charbon-700 px-2 py-1 text-[12px]"
              >
                <option value="UNDER_REVIEW">{t("review")}</option>
                <option value="RESOLVED">{t("resolve")}</option>
                <option value="CLOSED">{t("close")}</option>
              </select>
              </div>
            </div>
          ))}
          {filteredDisputes.length === 0 && (
            <p className="text-[13px] text-texte-dim">{hasFilters ? tFilters("noResults") : t("noDisputes")}</p>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
