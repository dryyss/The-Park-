"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminConversationThread } from "@/server/admin/messages-admin.service";

export function AdminMessageThreadPanel({ thread }: { thread: AdminConversationThread }) {
  const t = useTranslations("admin.messages");

  return (
    <div className="space-y-6">
      <div className={`rounded-[14px] border p-4 ${thread.involvesMinor ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}>
        <p className="text-or text-[10px] font-extrabold uppercase">{t(`contexts.${thread.context}`)}</p>
        <p className="text-blanc-casse mt-1 text-[13px] font-bold">{thread.participants.map((p) => p.name).join(" · ")}</p>
        {thread.involvesMinor && <p className="text-neon-orange mt-1 text-[11px] font-extrabold uppercase">{t("minorThread")}</p>}
        {thread.disputeId && (
          <Link href={`/admin/moderation/litiges/${thread.disputeId}`} className="text-carmin mt-2 inline-block text-[12px] font-bold hover:underline">{t("viewDispute")}</Link>
        )}
      </div>

      <div className="flex max-h-[600px] flex-col gap-3 overflow-y-auto rounded-[16px] border border-charbon-500 bg-charbon-900/50 p-4">
        {thread.messages.map((m) => (
          <div key={m.id} className="rounded-[12px] border border-charbon-600 bg-charbon-800 p-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/admin/utilisateurs/${m.senderId}`} className="text-[12px] font-extrabold text-carmin hover:underline">{m.senderName}</Link>
              <span className="text-texte-faible text-[10px]">{m.createdAt.toISOString().slice(0, 16)}</span>
            </div>
            {m.body && <p className="text-blanc-casse mt-2 text-[13px] whitespace-pre-wrap">{m.body}</p>}
            {m.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.attachments.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative block h-24 w-24 overflow-hidden rounded-lg border border-charbon-500">
                    <Image src={url} alt="" fill className="object-cover" sizes="96px" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {thread.messages.length === 0 && <p className="text-center text-[13px] text-texte-dim">{t("noMessages")}</p>}
      </div>
    </div>
  );
}
