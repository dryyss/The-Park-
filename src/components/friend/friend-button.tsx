"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  sendFriendRequestAction,
  acceptFriendRequestAction,
  removeFriendshipAction,
} from "@/server/friend/friend.actions";
import type { FriendshipView } from "@/server/friend/friend.service";

interface FriendButtonProps {
  addresseeSlug: string;
  friendshipId?: string;
  initialStatus: FriendshipView;
}

export function FriendButton({ addresseeSlug, friendshipId, initialStatus }: FriendButtonProps) {
  const t = useTranslations("friends");
  const [status, setStatus] = useState<FriendshipView>(initialStatus);
  const [fId, setFId] = useState(friendshipId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    startTransition(async () => {
      setError(null);
      const res = await sendFriendRequestAction(addresseeSlug);
      if (res.ok) setStatus("PENDING_SENT");
      else setError(t("errorGeneric"));
    });
  }

  function handleAccept() {
    if (!fId) return;
    startTransition(async () => {
      setError(null);
      const res = await acceptFriendRequestAction(fId);
      if (res.ok) setStatus("ACCEPTED");
      else setError(t("errorGeneric"));
    });
  }

  function handleRemove() {
    if (!fId) return;
    startTransition(async () => {
      setError(null);
      const res = await removeFriendshipAction(fId);
      if (res.ok) setStatus("NONE");
      else setError(t("errorGeneric"));
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {status === "NONE" && (
        <button
          type="button"
          disabled={pending}
          onClick={handleAdd}
          className="rounded-[10px] border border-charbon-400 px-4 py-2 font-display text-[12px] tracking-[1px] text-texte-doux uppercase transition hover:border-carmin hover:text-carmin disabled:opacity-50"
        >
          {t("addFriend")}
        </button>
      )}
      {status === "PENDING_SENT" && (
        <span className="rounded-[10px] border border-charbon-500 px-4 py-2 font-display text-[12px] tracking-[1px] text-texte-faible uppercase">
          {t("requestSent")}
        </span>
      )}
      {status === "PENDING_RECEIVED" && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleAccept}
            className="rounded-[10px] bg-neon-vert px-4 py-2 font-display text-[12px] tracking-[1px] text-charbon uppercase disabled:opacity-50"
          >
            {t("accept")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleRemove}
            className="rounded-[10px] border border-charbon-400 px-4 py-2 font-display text-[12px] tracking-[1px] text-texte-doux uppercase disabled:opacity-50"
          >
            {t("decline")}
          </button>
        </div>
      )}
      {status === "ACCEPTED" && (
        <button
          type="button"
          disabled={pending}
          onClick={handleRemove}
          className="rounded-[10px] border border-neon-vert/40 px-4 py-2 font-display text-[12px] tracking-[1px] text-neon-vert uppercase transition hover:border-neon-rouge/50 hover:text-neon-rouge disabled:opacity-50"
        >
          {t("alreadyFriends")} ✓
        </button>
      )}
      {error && <p className="text-[11px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
