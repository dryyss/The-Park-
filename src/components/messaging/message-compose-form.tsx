"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { sendMessageAction } from "@/server/messaging/messaging.actions";

export function MessageComposeForm({ conversationId }: { conversationId: string }) {
  const t = useTranslations("messages");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const res = await sendMessageAction({ conversationId, body });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="border-t border-charbon-500 p-4">
      {error && <p className="mb-2 text-[12px] font-bold text-neon-rouge">{error}</p>}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("inputPlaceholder")}
          maxLength={2000}
          className="flex-1 rounded-[11px] border border-charbon-500 bg-charbon-700 px-4 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
        />
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="rounded-[11px] bg-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-white uppercase disabled:opacity-50"
        >
          {t("send")}
        </button>
      </div>
    </form>
  );
}
