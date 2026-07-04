"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { replyTicketAction, setTicketStatusAction } from "@/server/support/ticket.actions";
import type { TicketThread } from "@/server/support/ticket.service";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-carmin/15 text-carmin",
  PENDING: "bg-or/15 text-or",
  RESOLVED: "bg-statut-succes/15 text-statut-succes",
  CLOSED: "bg-charbon-600 text-texte-dim",
};

export function TicketThreadView({ thread, isStaff }: { thread: TicketThread; isStaff: boolean }) {
  const t = useTranslations("support");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closed = thread.status === "CLOSED";

  function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await replyTicketAction({ ticketId: thread.id, body });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  function changeStatus(status: string) {
    startTransition(async () => {
      await setTicketStatusAction(thread.id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] tracking-[0.5px] text-blanc-casse">{thread.subject}</h1>
          <p className="mt-1 text-[11px] font-bold text-texte-dim">
            {t(`category.${thread.category}`)} · {isStaff ? thread.ownerName : t("you")}
          </p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-[11px] font-extrabold uppercase ${STATUS_COLORS[thread.status] ?? ""}`}>
          {t(`status.${thread.status}`)}
        </span>
      </div>

      {isStaff && (
        <div className="flex flex-wrap gap-1.5">
          {(["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending || thread.status === s}
              onClick={() => changeStatus(s)}
              className="rounded-md border border-charbon-500 px-2.5 py-1 text-[10.5px] font-extrabold text-texte-dim transition hover:border-carmin hover:text-carmin disabled:opacity-40"
            >
              {t(`status.${s}`)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={[
              "max-w-[85%] rounded-2xl border px-4 py-3",
              m.isStaff
                ? "self-start border-carmin/30 bg-carmin/5"
                : "self-end border-charbon-600 bg-charbon-800/60",
            ].join(" ")}
          >
            <p className="text-[10px] font-extrabold tracking-[1px] text-texte-dim uppercase">
              {m.isStaff ? t("staffLabel") : m.authorName}
            </p>
            <p className="mt-1 text-[13px] whitespace-pre-wrap text-blanc-casse">{m.body}</p>
          </div>
        ))}
      </div>

      {closed ? (
        <p className="rounded-xl border border-charbon-600 bg-charbon-800/40 px-4 py-3 text-center text-[12px] font-bold text-texte-dim">
          {t("closedNote")}
        </p>
      ) : (
        <form onSubmit={reply} className="mt-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("replyPlaceholder")}
            rows={3}
            maxLength={5000}
            className="w-full resize-y rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className="font-display rounded-lg bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
            >
              {pending ? t("sending") : t("reply")}
            </button>
            {error && <span className="text-[11px] font-bold text-neon-rouge">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
