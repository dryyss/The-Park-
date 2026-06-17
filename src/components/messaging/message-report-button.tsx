"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { reportMessageAction } from "@/server/messaging/messaging.actions";

export function MessageReportButton({ messageId }: { messageId: string }) {
  const t = useTranslations("messages");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      setFeedback(null);
      const res = await reportMessageAction({ messageId, reason });
      if (!res.ok) {
        setFeedback("error");
        return;
      }
      setFeedback("success");
      setReason("");
      setTimeout(() => {
        setOpen(false);
        setFeedback(null);
      }, 2000);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-extrabold text-texte-faible opacity-0 transition group-hover:opacity-100 hover:text-neon-rouge"
        title={t("report")}
      >
        {t("report")}
      </button>
    );
  }

  return (
    <div className="mt-2 w-full min-w-[200px] rounded-lg border border-charbon-500 bg-charbon-800 p-2.5">
      <p className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("reportTitle")}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reportPlaceholder")}
        maxLength={500}
        rows={2}
        className="mt-1.5 w-full resize-none rounded-md border border-charbon-500 bg-charbon-700 px-2 py-1.5 text-[11px] text-blanc-casse outline-none focus:border-carmin"
      />
      {feedback === "success" && (
        <p className="mt-1 text-[10px] font-bold text-neon-vert">{t("reportSuccess")}</p>
      )}
      {feedback === "error" && (
        <p className="mt-1 text-[10px] font-bold text-neon-rouge">{t("reportError")}</p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending || reason.trim().length < 3}
          onClick={submit}
          className="rounded-md bg-carmin px-2.5 py-1 text-[10px] font-extrabold text-white uppercase disabled:opacity-50"
        >
          {t("reportSubmit")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
            setFeedback(null);
          }}
          className="text-[10px] font-bold text-texte-dim hover:text-blanc-casse"
        >
          {t("reportCancel")}
        </button>
      </div>
    </div>
  );
}
