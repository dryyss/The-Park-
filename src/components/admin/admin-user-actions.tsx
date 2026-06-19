"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { suspendUserAction, reactivateUserAction, banUserAction } from "@/server/admin/users.actions";

export function AdminUserActions({ userId, status }: { userId: string; status: string }) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canReactivate = status === "SUSPENDED" || status === "BANNED";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(errLabel(t, res.error));
    });
  }

  return (
    <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <h2 className="font-display text-[15px] tracking-wide text-blanc-casse uppercase">{t("actionsTitle")}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("suspendUntil")}</span>
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("reason")}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-[13px] font-bold text-neon-rouge">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              suspendUserAction({
                userId,
                until: until ? new Date(until).toISOString() : null,
                reason: reason || undefined,
              }),
            )
          }
          className="rounded-lg border border-neon-orange/50 px-4 py-2 text-[11px] font-extrabold text-neon-orange uppercase hover:bg-neon-orange/10 disabled:opacity-50"
        >
          {t("suspend")}
        </button>
        {canReactivate && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reactivateUserAction({ userId }))}
            className="rounded-lg border border-neon-vert/50 px-4 py-2 text-[11px] font-extrabold text-neon-vert uppercase hover:bg-neon-vert/10 disabled:opacity-50"
          >
            {t("reactivate")}
          </button>
        )}
        {status !== "BANNED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(t("confirmBanSimple"))) run(() => banUserAction({ userId, reason: reason || undefined }));
            }}
            className="rounded-lg border border-neon-rouge/50 px-4 py-2 text-[11px] font-extrabold text-neon-rouge uppercase hover:bg-neon-rouge/10 disabled:opacity-50"
          >
            {t("ban")}
          </button>
        )}
      </div>
    </div>
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
