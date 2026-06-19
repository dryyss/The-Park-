"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { AdminPaymentRow, AdminWalletRow } from "@/server/admin/finance-admin.service";
import { adminAdjustWalletAction } from "@/server/admin/admin.actions";

const PAYMENT_STATUSES = ["REQUIRES_PAYMENT", "AUTHORIZED", "CAPTURED", "RELEASED", "REFUNDED", "CANCELLED", "FAILED"] as const;
const PAYMENT_KINDS = ["CAUTION", "PURCHASE", "SECURED_FEE", "STORE_ORDER", "AUCTION_PAYMENT", "WALLET_TOP_UP"] as const;

export function AdminFinancePanel({
  tab,
  payments,
  wallets,
  stats,
  canAdjust,
  paymentStatus,
  paymentKind,
  query,
}: {
  tab: string;
  payments: { rows: AdminPaymentRow[]; total: number; page: number; pageSize: number };
  wallets: { rows: AdminWalletRow[]; total: number; page: number; pageSize: number };
  stats: { paymentsPending: number; paymentsCaptured: number; wallets: number; totalDepositEur: number; totalEarnedEur: number };
  canAdjust: boolean;
  paymentStatus: string;
  paymentKind: string;
  query: string;
}) {
  const t = useTranslations("admin.finance");
  const router = useRouter();
  const activeTab = tab || "payments";
  const [q, setQ] = useState(query);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<"deposit" | "earned">("deposit");
  const [adjustNote, setAdjustNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function navigate(nextTab: string, extra?: Record<string, string>) {
    const sp = new URLSearchParams({ tab: nextTab, ...extra });
    router.push(`/admin/finances?${sp.toString()}`);
  }

  function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await adminAdjustWalletAction({
        userId: adjustUserId,
        amountEur: Number(adjustAmount),
        target: adjustTarget,
        note: adjustNote,
      });
      if (res.ok) {
        setAdjustUserId("");
        setAdjustAmount("");
        setAdjustNote("");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { key: "paymentsPending", value: stats.paymentsPending, alert: stats.paymentsPending > 0 },
          { key: "paymentsCaptured", value: stats.paymentsCaptured },
          { key: "wallets", value: stats.wallets },
          { key: "totalDeposit", value: `${stats.totalDepositEur.toFixed(2)} €` },
          { key: "totalEarned", value: `${stats.totalEarnedEur.toFixed(2)} €` },
        ].map((s) => (
          <div key={s.key} className={`rounded-[12px] border p-3 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
            <p className="text-texte-dim text-[9px] font-extrabold uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display text-blanc-casse mt-1 text-[20px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-charbon-500 pb-3">
        {(["payments", "wallets"] as const).map((tabKey) => (
          <button key={tabKey} type="button" onClick={() => navigate(tabKey)} className={`rounded-lg px-4 py-2 text-[11px] font-extrabold uppercase ${activeTab === tabKey ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"}`}>
            {t(`tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {activeTab === "payments" && (
        <>
          <div className="flex flex-wrap gap-3">
            <select value={paymentStatus} onChange={(e) => navigate("payments", e.target.value ? { paymentStatus: e.target.value } : {})} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
              <option value="">{t("allStatuses")}</option>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{t(`paymentStatuses.${s}`)}</option>)}
            </select>
            <select value={paymentKind} onChange={(e) => navigate("payments", e.target.value ? { paymentKind: e.target.value } : {})} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
              <option value="">{t("allKinds")}</option>
              {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{t(`paymentKinds.${k}`)}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
            <table className="w-full min-w-[700px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
                  <th className="px-4 py-3">{t("colKind")}</th>
                  <th className="px-4 py-3">{t("colAmount")}</th>
                  <th className="px-4 py-3">{t("colStatus")}</th>
                  <th className="px-4 py-3">{t("colUser")}</th>
                  <th className="px-4 py-3">{t("colDate")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.rows.map((p) => (
                  <tr key={p.id} className="border-b border-charbon-600/50">
                    <td className="px-4 py-3">{t(`paymentKinds.${p.kind}`)}</td>
                    <td className="px-4 py-3 text-or">{p.amount}</td>
                    <td className="px-4 py-3">{t(`paymentStatuses.${p.status}`)}</td>
                    <td className="px-4 py-3">{p.userName ?? "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-texte-dim">{p.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments.rows.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("emptyPayments")}</p>}
          </div>
        </>
      )}

      {activeTab === "wallets" && (
        <>
          <div className="flex gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && navigate("wallets", q.trim() ? { q: q.trim() } : {})} placeholder={t("searchPlaceholder")} className="flex-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
            <button type="button" onClick={() => navigate("wallets", q.trim() ? { q: q.trim() } : {})} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase">{t("filter")}</button>
          </div>
          <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
            <table className="w-full min-w-[700px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
                  <th className="px-4 py-3">{t("colMember")}</th>
                  <th className="px-4 py-3">{t("colDeposit")}</th>
                  <th className="px-4 py-3">{t("colEarned")}</th>
                  <th className="px-4 py-3">{t("colTotal")}</th>
                  <th className="px-4 py-3">{t("colEntries")}</th>
                </tr>
              </thead>
              <tbody>
                {wallets.rows.map((w) => (
                  <tr key={w.userId} className="border-b border-charbon-600/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/utilisateurs/${w.userId}`} className="font-extrabold text-carmin hover:underline">{w.displayName}</Link>
                      <span className="block text-[11px] text-texte-faible">{w.email}</span>
                    </td>
                    <td className="px-4 py-3">{w.depositBalance}</td>
                    <td className="px-4 py-3 text-or">{w.earnedBalance}</td>
                    <td className="px-4 py-3 font-bold text-blanc-casse">{w.totalBalance}</td>
                    <td className="px-4 py-3 text-texte-dim">{w.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wallets.rows.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("emptyWallets")}</p>}
          </div>

          {canAdjust && (
            <form onSubmit={submitAdjust} className="rounded-[16px] border border-or/30 bg-or/5 p-5">
              <h3 className="font-display text-or mb-4 text-[14px] uppercase">{t("adjustTitle")}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <input required value={adjustUserId} onChange={(e) => setAdjustUserId(e.target.value)} placeholder={t("adjustUserId")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
                <input required type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder={t("adjustAmount")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
                <select value={adjustTarget} onChange={(e) => setAdjustTarget(e.target.value as "deposit" | "earned")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
                  <option value="deposit">{t("adjustDeposit")}</option>
                  <option value="earned">{t("adjustEarned")}</option>
                </select>
                <input required value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder={t("adjustNote")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
              </div>
              {error && <p className="mt-2 text-[13px] font-bold text-neon-rouge">{error}</p>}
              <button type="submit" disabled={pending} className="mt-4 rounded-lg bg-or px-5 py-2 text-[12px] font-extrabold text-charbon uppercase disabled:opacity-50">{t("adjustSubmit")}</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
