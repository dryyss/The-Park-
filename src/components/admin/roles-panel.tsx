"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminRole } from "@/generated/prisma/client";
import type { StaffMemberRow } from "@/server/auth/roles.service";
import {
  assignStaffRoleAction,
  revokeStaffRoleAction,
  setupAuth0RolesAction,
} from "@/server/admin/roles.actions";
import { AdminFilterBar, AdminFilterSelect, matchAdminSearch } from "@/components/admin/admin-filter-bar";

const STAFF_ROLES: AdminRole[] = ["OWNER", "MODERATOR", "CATALOG_MANAGER", "SHOP_MANAGER", "SUPPORT"];

export function RolesAdminPanel({ members, isOwner }: { members: StaffMemberRow[]; isOwner: boolean }) {
  const t = useTranslations("admin.roles");
  const tFilters = useTranslations("admin.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        if (roleFilter && m.staffRole !== roleFilter) return false;
        return matchAdminSearch(q, m.displayName, m.email);
      }),
    [members, q, roleFilter],
  );

  const hasFilters = Boolean(q.trim() || roleFilter);

  function handleSetupRoles() {
    setMessage(null);
    startTransition(async () => {
      const res = await setupAuth0RolesAction();
      if (res.ok) {
        setMessage(t("setupSuccess", { created: res.created.length, existing: res.existing.length }));
      } else {
        setMessage(t("setupError"));
      }
    });
  }

  function handleAssign(userId: string, staffRole: AdminRole) {
    setMessage(null);
    startTransition(async () => {
      const res = await assignStaffRoleAction({ targetUserId: userId, staffRole });
      if (res.ok) {
        router.refresh();
        setMessage(t("assignSuccess"));
      } else {
        setMessage(t("assignError"));
      }
    });
  }

  function handleRevoke(userId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await revokeStaffRoleAction(userId);
      if (res.ok) {
        router.refresh();
        setMessage(t("revokeSuccess"));
      } else {
        setMessage(t("revokeError"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {isOwner && (
        <section className="rounded-[16px] border border-or/30 bg-or/5 p-5">
          <h2 className="font-display text-[15px] tracking-wide text-or uppercase">{t("setupTitle")}</h2>
          <p className="mt-2 text-[13px] font-bold text-texte-dim">{t("setupHint")}</p>
          <button
            type="button"
            disabled={pending}
            onClick={handleSetupRoles}
            className="font-display mt-4 rounded-[10px] bg-or px-5 py-2.5 text-[12px] tracking-[1px] text-charbon uppercase transition hover:bg-or-clair disabled:opacity-50"
          >
            {t("setupCta")}
          </button>
        </section>
      )}

      {message && (
        <p className="rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-3 text-center text-[13px] font-bold text-blanc-casse">
          {message}
        </p>
      )}

      <AdminFilterBar
        live
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("searchPlaceholder")}
        onReset={hasFilters ? () => { setQ(""); setRoleFilter(""); } : undefined}
      >
        <AdminFilterSelect
          label={t("filterRole")}
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: "", label: t("roleAll") },
            ...STAFF_ROLES.map((r) => ({ value: r, label: t(`staffRoles.${r}`) })),
          ]}
        />
      </AdminFilterBar>

      <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("colMember")}</th>
              <th className="px-4 py-3">{t("colRole")}</th>
              <th className="px-4 py-3">{t("colAuth0")}</th>
              {isOwner && <th className="px-4 py-3">{t("colActions")}</th>}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.id} className="border-b border-charbon-600/50">
                <td className="px-4 py-3">
                  <p className="font-extrabold text-blanc-casse">{m.displayName}</p>
                  <p className="text-[11px] text-texte-dim">{m.email}</p>
                </td>
                <td className="px-4 py-3">
                  {isOwner ? (
                    <select
                      defaultValue={m.staffRole ?? "SUPPORT"}
                      disabled={pending}
                      className="rounded-lg border border-charbon-500 bg-charbon-700 px-2 py-1.5 text-[12px] text-blanc-casse"
                      onChange={(e) => handleAssign(m.id, e.target.value as AdminRole)}
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`staffRoles.${r}`)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-bold text-or">{m.staffRole ? t(`staffRoles.${m.staffRole}`) : "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-texte-faible">{m.auth0Id ? "✓" : "—"}</td>
                {isOwner && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRevoke(m.id)}
                      className="text-[11px] font-extrabold text-neon-rouge hover:underline disabled:opacity-50"
                    >
                      {t("revoke")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredMembers.length === 0 && (
          <p className="p-8 text-center text-[13px] font-bold text-texte-dim">
            {hasFilters ? tFilters("noResults") : t("empty")}
          </p>
        )}
      </div>

      <p className="text-[11px] font-bold text-texte-faible">{t("triggerHint")}</p>
    </div>
  );
}
