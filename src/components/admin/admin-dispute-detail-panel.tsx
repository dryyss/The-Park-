"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import type { AdminDisputeDetail } from "@/server/admin/disputes-admin.service";
import { resolveDisputeArbitrationAction } from "@/server/admin/admin.actions";
import { updateDisputeStatusAction } from "@/server/moderation/moderation.actions";

const VERDICTS = ["FAVOR_CLAIMANT", "FAVOR_RESPONDENT", "SPLIT"] as const;
const CAPTURES = ["FULL", "PARTIAL", "NONE", "REFUND"] as const;

export function AdminDisputeDetailPanel({ dispute }: { dispute: AdminDisputeDetail }) {
  const t = useTranslations("admin.disputes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<(typeof VERDICTS)[number]>("FAVOR_CLAIMANT");
  const [captureDecision, setCaptureDecision] = useState<(typeof CAPTURES)[number]>("REFUND");
  const [captureAmount, setCaptureAmount] = useState("");
  const [notes, setNotes] = useState("");

  const resolved = dispute.resolution != null;

  function updateStatus(status: "UNDER_REVIEW" | "AWAITING_EVIDENCE") {
    startTransition(async () => {
      await updateDisputeStatusAction(dispute.id, status);
      router.refresh();
    });
  }

  function submitArbitration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await resolveDisputeArbitrationAction({
        disputeId: dispute.id,
        verdict,
        captureDecision,
        captureAmount: captureAmount ? Number(captureAmount) : undefined,
        notes: notes || undefined,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      <div className={`rounded-[16px] border p-5 ${dispute.involvesMinor ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-or text-[10px] font-extrabold tracking-wide uppercase">{dispute.type}</p>
            <h2 className="font-display text-blanc-casse mt-1 text-[20px] uppercase">
              {dispute.claimant.name} vs {dispute.respondent.name}
            </h2>
            <p className="text-texte-dim mt-2 text-[13px]">{dispute.reason}</p>
          </div>
          <span className="rounded-md bg-charbon-600 px-3 py-1 text-[11px] font-extrabold uppercase">{dispute.status}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-texte-dim">
          <span>{t("opened")}: {dispute.openedAt.toISOString().slice(0, 16)}</span>
          {dispute.dueAt && <span>{t("due")}: {dispute.dueAt.toISOString().slice(0, 16)}</span>}
          {dispute.involvesMinor && <span className="text-neon-orange font-extrabold uppercase">{t("minor")}</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/admin/utilisateurs/${dispute.claimant.id}`} className="text-[12px] font-bold text-carmin hover:underline">{t("claimant")}</Link>
          <Link href={`/admin/utilisateurs/${dispute.respondent.id}`} className="text-[12px] font-bold text-carmin hover:underline">{t("respondent")}</Link>
          {dispute.conversationId && (
            <Link href={`/admin/messages/${dispute.conversationId}`} className="text-[12px] font-bold text-carmin hover:underline">{t("viewMessages")}</Link>
          )}
        </div>
        {!resolved && (
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={pending} onClick={() => updateStatus("UNDER_REVIEW")} className="rounded-md border border-charbon-400 px-3 py-1 text-[10px] font-extrabold uppercase">{t("markReview")}</button>
            <button type="button" disabled={pending} onClick={() => updateStatus("AWAITING_EVIDENCE")} className="rounded-md border border-charbon-400 px-3 py-1 text-[10px] font-extrabold uppercase">{t("awaitEvidence")}</button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h3 className="font-display text-blanc-casse mb-4 text-[14px] uppercase">{t("payments")}</h3>
          {dispute.payments.length === 0 ? (
            <p className="text-[13px] text-texte-dim">{t("noPayments")}</p>
          ) : (
            <ul className="space-y-2">
              {dispute.payments.map((p) => (
                <li key={p.id} className="flex justify-between text-[13px]">
                  <span className="text-texte-dim">{t(`paymentKinds.${p.kind}`)} · {p.status}</span>
                  <span className="text-or font-bold">{p.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h3 className="font-display text-blanc-casse mb-4 text-[14px] uppercase">{t("timeline")}</h3>
          {dispute.events.length === 0 ? (
            <p className="text-[13px] text-texte-dim">{t("noEvents")}</p>
          ) : (
            <ul className="max-h-[200px] space-y-2 overflow-y-auto text-[12px]">
              {dispute.events.map((e) => (
                <li key={e.id} className="text-texte-dim">
                  <span className="text-blanc-casse font-bold">{e.event}</span>
                  {e.fromStatus && ` ${e.fromStatus} → ${e.toStatus}`}
                  <span className="text-texte-faible ml-2">{e.createdAt.toISOString().slice(0, 16)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {dispute.evidence.length > 0 && (
        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h3 className="font-display text-blanc-casse mb-4 text-[14px] uppercase">{t("evidence")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {dispute.evidence.map((e) => (
              <div key={e.id} className="rounded-[10px] border border-charbon-600 p-3">
                <p className="text-[11px] font-extrabold text-blanc-casse">{e.kind} · {e.uploaderName}</p>
                <a href={e.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-carmin mt-1 block truncate text-[12px] hover:underline">{e.mediaUrl}</a>
              </div>
            ))}
          </div>
        </section>
      )}

      {resolved && dispute.resolution ? (
        <section className="rounded-[16px] border border-neon-vert/30 bg-neon-vert/5 p-5">
          <h3 className="font-display text-neon-vert mb-3 text-[14px] uppercase">{t("resolutionTitle")}</h3>
          <p className="text-[13px] text-blanc-casse">
            {t(`verdicts.${dispute.resolution.verdict}`)} · {t(`captures.${dispute.resolution.captureDecision}`)}
            {Number(dispute.resolution.captureAmount.replace(/[^\d.,]/g, "")) > 0 && ` · ${dispute.resolution.captureAmount}`}
          </p>
          {dispute.resolution.notes && <p className="text-texte-dim mt-2 text-[13px]">{dispute.resolution.notes}</p>}
          <p className="text-texte-faible mt-2 text-[11px]">{dispute.resolution.moderatorName} · {dispute.resolution.createdAt.toISOString().slice(0, 16)}</p>
        </section>
      ) : (
        <form onSubmit={submitArbitration} className="rounded-[16px] border border-carmin/30 bg-carmin/5 p-5">
          <h3 className="font-display text-carmin mb-4 text-[14px] uppercase">{t("arbitrateTitle")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("verdict")}</label>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value as (typeof VERDICTS)[number])} className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
                {VERDICTS.map((v) => <option key={v} value={v}>{t(`verdicts.${v}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("capture")}</label>
              <select value={captureDecision} onChange={(e) => setCaptureDecision(e.target.value as (typeof CAPTURES)[number])} className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse">
                {CAPTURES.map((c) => <option key={c} value={c}>{t(`captures.${c}`)}</option>)}
              </select>
            </div>
            {captureDecision === "PARTIAL" && (
              <div>
                <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("captureAmount")}</label>
                <input type="number" step="0.01" min="0" value={captureAmount} onChange={(e) => setCaptureAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="text-[10px] font-extrabold text-texte-dim uppercase">{t("notes")}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
            </div>
          </div>
          {error && <p className="mt-3 text-[13px] font-bold text-neon-rouge">{error}</p>}
          <button type="submit" disabled={pending} className="mt-4 rounded-lg bg-carmin px-5 py-2.5 text-[12px] font-extrabold text-white uppercase disabled:opacity-50">{t("submitArbitration")}</button>
        </form>
      )}
    </div>
  );
}
