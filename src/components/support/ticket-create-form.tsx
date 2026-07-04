"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createTicketAction } from "@/server/support/ticket.actions";
import { TICKET_CATEGORIES } from "@/lib/support-categories";

export function TicketCreateForm() {
  const t = useTranslations("support");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createTicketAction({ subject, category, body });
      if (res.ok) {
        setSubject("");
        setBody("");
        setOpen(false);
        router.push(`/support/${res.id}`);
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-display rounded-lg bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
      >
        {t("newTicket")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-charbon-600 bg-charbon-900/50 p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("subjectPlaceholder")}
          maxLength={160}
          className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[13px] font-bold text-blanc-casse outline-none focus:border-carmin"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[12px] font-bold text-blanc-casse outline-none focus:border-carmin"
        >
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("bodyPlaceholder")}
        rows={4}
        maxLength={5000}
        className="mt-3 w-full resize-y rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || subject.length < 3 || body.length < 5}
          className="font-display rounded-lg bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {pending ? t("sending") : t("send")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-charbon-500 px-4 py-2.5 text-[12px] font-bold text-texte-dim hover:border-charbon-400"
        >
          {t("cancel")}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
    </form>
  );
}
