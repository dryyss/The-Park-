import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import type { ConversationListItem } from "@/server/messaging/conversation.service";
import { MessageComposeForm } from "@/components/messaging/message-compose-form";

export async function ConversationList({ items }: { items: ConversationListItem[] }) {
  const t = await getTranslations("messages");

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
        <p className="mt-2 text-[12px] font-bold text-texte-faible">{t("contextHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <Link
          key={c.id}
          href={`/messages/${c.id}`}
          className={`flex items-center gap-3 rounded-[15px] border-[1.5px] p-4 transition hover:border-carmin ${c.unread ? "border-carmin/40 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
        >
          <span
            className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] text-white"
            style={{ background: avatarGradient(c.partnerInitial) }}
          >
            {c.partnerInitial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-extrabold text-blanc-casse">{c.partnerName}</p>
              <span className="rounded-md bg-charbon-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">
                {t(`context.${c.contextLabel}`)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] font-bold text-texte-dim">{c.lastMessage ?? "—"}</p>
          </div>
          {c.lastMessageAt && (
            <span className="shrink-0 text-[10.5px] font-bold text-texte-faible">
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(c.lastMessageAt)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export async function ConversationThreadView({
  thread,
}: {
  thread: import("@/server/messaging/conversation.service").ConversationThread;
}) {
  const t = await getTranslations("messages");

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[480px] flex-col rounded-[18px] border border-charbon-500 bg-charbon-800">
      <div className="flex items-center gap-3 border-b border-charbon-500 px-5 py-4">
        <Link href="/messages" className="text-[12px] font-extrabold text-carmin hover:underline">
          ← {t("back")}
        </Link>
        <div className="flex-1 text-center">
          <p className="text-[14px] font-extrabold text-blanc-casse">{thread.partnerName}</p>
          <p className="text-[11px] font-bold text-texte-dim">{t(`context.${thread.contextLabel}`)}</p>
        </div>
        {thread.exchangeId && (
          <Link href={`/echanges?id=${thread.exchangeId}`} className="text-[11px] font-extrabold text-carmin hover:underline">
            {t("viewExchange")}
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {thread.messages.map((m) => (
          <div key={m.id} className={`flex ${m.isViewer ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-[14px] px-4 py-2.5 ${m.isViewer ? "bg-carmin text-white" : "bg-charbon-700 text-blanc-casse"}`}
            >
              {!m.isViewer && <p className="mb-1 text-[10px] font-extrabold opacity-70">{m.senderName}</p>}
              <p className="text-[13px] font-semibold">{m.body}</p>
              <p className={`mt-1 text-[10px] font-bold ${m.isViewer ? "text-white/60" : "text-texte-faible"}`}>
                {new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <MessageComposeForm conversationId={thread.id} />
    </div>
  );
}
