"use client";

import { useEffect, useRef, useState } from "react";
import type { ThreadMessage } from "@/server/messaging/conversation.service";
import { getPusherClient, isPusherClientConfigured, userChannelName } from "@/lib/pusher-client";
import { MessageReportButton } from "@/components/messaging/message-report-button";

type LiveMessage = ThreadMessage;

interface ChatMessageEvent {
  conversationId: string;
  message: {
    id: string;
    body: string;
    senderId: string;
    senderName: string;
    senderInitial: string;
    isViewer: boolean;
    createdAt: string;
  };
}

export function ConversationMessageList({
  conversationId,
  viewerId,
  initialMessages,
}: {
  conversationId: string;
  viewerId: string;
  initialMessages: ThreadMessage[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<LiveMessage[]>(initialMessages);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!isPusherClientConfigured()) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(userChannelName(viewerId));

    const onChatMessage = (data: ChatMessageEvent) => {
      if (data.conversationId !== conversationId) return;
      const incoming = data.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [
          ...prev,
          {
            id: incoming.id,
            body: incoming.body,
            senderId: incoming.senderId,
            senderName: incoming.senderName,
            senderInitial: incoming.senderInitial,
            isViewer: incoming.isViewer,
            createdAt: new Date(incoming.createdAt),
          },
        ];
      });
    };

    channel.bind("chat-message", onChatMessage);

    return () => {
      channel.unbind("chat-message", onChatMessage);
      pusher.unsubscribe(userChannelName(viewerId));
    };
  }, [conversationId, viewerId]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
      {messages.map((m) => (
        <div key={m.id} className={`group flex ${m.isViewer ? "justify-end" : "justify-start"}`}>
          <div
            className={`relative max-w-[75%] rounded-[14px] px-4 py-2.5 ${m.isViewer ? "bg-carmin text-white" : "bg-charbon-700 text-blanc-casse"}`}
          >
            {!m.isViewer && <p className="mb-1 text-[10px] font-extrabold opacity-70">{m.senderName}</p>}
            <p className="text-[13px] font-semibold">{m.body}</p>
            <div className={`mt-1 flex items-center gap-2 ${m.isViewer ? "justify-end" : "justify-between"}`}>
              <p className={`text-[10px] font-bold ${m.isViewer ? "text-white/60" : "text-texte-faible"}`}>
                {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(m.createdAt)}
              </p>
              {!m.isViewer && <MessageReportButton messageId={m.id} />}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
