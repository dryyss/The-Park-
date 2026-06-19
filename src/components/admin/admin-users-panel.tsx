"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { AdminUserListResult, AdminUserRow } from "@/server/admin/users.service";
import { suspendUserAction, reactivateUserAction, banUserAction } from "@/server/admin/users.actions";

const STATUSES = ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "BANNED", "DELETED"] as const;

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-neon-vert/15 text-neon-vert",
  PENDING_VERIFICATION: "bg-charbon-600 text-texte-dim",
  SUSPENDED: "bg-neon-orange/15 text-neon-orange",
  BANNED: "bg-neon-rouge/15 text-neon-rouge",
  DELETED: "bg-charbon-600 text-texte-faible",
};

export function AdminUsersPanel({
  result,
  query,
  status,
}: {
  result: AdminUserListResult;
  query: string;
  status: string;
}) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [st, setSt] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function applyFilters(nextPage = 1) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (st) sp.set("status", st);
    if (nextPage > 1) sp.set("page", String(nextPage));
    router.push(`/admin/utilisateurs${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(errLabel(t, res.error));
    });
  }

  return (
    <div>
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
              <option key={s} value={s} className="bg-charbon-800">{t(`status_${s}`)}</option>
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
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("colMember")}</th>
              <th className="px-4 py-3">{t("colStatus")}</th>
              <th className="px-4 py-3">{t("colRole")}</th>
              <th className="px-4 py-3">{t("colLastLogin")}</th>
              <th className="px-4 py-3">{t("colRating")}</th>
              <th className="px-4 py-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[13px] font-bold text-texte-faible">{t("empty")}</td>
              </tr>
            ) : (
              result.rows.map((u) => (
                <UserRow key={u.id} user={u} pending={pending} run={run} t={t} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px] font-bold text-texte-dim">
        <span>{t("total", { count: result.total })}</span>
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

function UserRow({
  user,
  pending,
  run,
  t,
}: {
  user: AdminUserRow;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const isStaff = user.staffRole != null;
  const canReactivate = user.status === "SUSPENDED" || user.status === "BANNED";

  return (
    <tr className="border-b border-charbon-600/50 hover:bg-charbon-700/40">
      <td className="px-4 py-3">
        <Link href={`/admin/utilisateurs/${user.id}`} className="block">
          <span className="font-extrabold text-blanc-casse hover:text-carmin">{user.displayName}</span>
          <span className="block text-[11px] font-bold text-texte-faible">{user.email}</span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_STYLE[user.status] ?? "bg-charbon-600 text-texte-dim"}`}>
          {t(`status_${user.status}`)}
        </span>
      </td>
      <td className="px-4 py-3 text-[12px] font-bold text-texte-dim">
        {isStaff ? <span className="text-or">{user.staffRole}</span> : user.role}
      </td>
      <td className="px-4 py-3 text-[12px] text-texte-dim">
        {user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : "—"}
      </td>
      <td className="px-4 py-3 text-[12px] text-texte-dim">
        {user.reviewCount > 0 ? `★ ${user.ratingAvg.toFixed(1)} (${user.reviewCount})` : "—"}
      </td>
      <td className="px-4 py-3">
        {isStaff ? (
          <span className="text-[11px] font-bold text-texte-faible">{t("staffProtected")}</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {canReactivate ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => reactivateUserAction({ userId: user.id }))}
                className="rounded-md border border-neon-vert/50 px-2.5 py-1 text-[10.5px] font-extrabold text-neon-vert uppercase hover:bg-neon-vert/10 disabled:opacity-50"
              >
                {t("reactivate")}
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => suspendUserAction({ userId: user.id }))}
                className="rounded-md border border-neon-orange/50 px-2.5 py-1 text-[10.5px] font-extrabold text-neon-orange uppercase hover:bg-neon-orange/10 disabled:opacity-50"
              >
                {t("suspend")}
              </button>
            )}
            {user.status !== "BANNED" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(t("confirmBan", { name: user.displayName }))) run(() => banUserAction({ userId: user.id }));
                }}
                className="rounded-md border border-neon-rouge/50 px-2.5 py-1 text-[10.5px] font-extrabold text-neon-rouge uppercase hover:bg-neon-rouge/10 disabled:opacity-50"
              >
                {t("ban")}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function errLabel(t: ReturnType<typeof useTranslations>, code?: string): string {
  switch (code) {
    case "SELF_ACTION":
      return t("errSelf");
    case "TARGET_IS_STAFF":
      return t("errStaff");
    case "NOT_FOUND":
      return t("errNotFound");
    case "VALIDATION":
      return t("errValidation");
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return t("errForbidden");
    default:
      return t("errUnknown");
  }
}
