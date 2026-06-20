"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleCardLikeAction } from "@/server/card-like/card-like.actions";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";

export function CardLikeButton({
  cardId,
  initialCount,
  initialLiked,
  isAuthenticated,
  overlay = false,
}: {
  cardId: string;
  initialCount: number;
  initialLiked: boolean;
  isAuthenticated: boolean;
  overlay?: boolean;
}) {
  const t = useTranslations("card");
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [showLoginGate, setShowLoginGate] = useState(false);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    setShowLoginGate(false);
    startTransition(async () => {
      const res = await toggleCardLikeAction({ cardId });
      if (res.ok) {
        setLiked(res.liked);
        setCount(res.count);
      }
    });
  }

  const label = liked ? t("unlikeLabel") : t("likeLabel");

  return (
    <div className={overlay ? "absolute top-2 right-2 z-10" : "inline-flex flex-col items-start gap-1"}>
      {showLoginGate && overlay && (
        <div className="absolute top-full right-0 mt-1 w-[200px]">
          <LoginGatePrompt compact messageKey="loginGateLike" />
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={label}
        title={t("likeCount", { count })}
        className={[
          "inline-flex items-center gap-1 rounded-full border font-extrabold transition",
          overlay
            ? "border-charbon-500/80 bg-charbon-900/75 px-2 py-1 text-[11px] backdrop-blur-sm hover:border-carmin"
            : "border-charbon-500 bg-charbon-800 px-3 py-1.5 text-[12px] hover:border-carmin",
          liked ? "text-carmin" : "text-blanc-casse",
          pending ? "opacity-60" : "",
        ].join(" ")}
      >
        <span aria-hidden className="text-[14px] leading-none">
          {liked ? "♥" : "♡"}
        </span>
        <span>{count}</span>
      </button>
      {showLoginGate && !overlay && <LoginGatePrompt compact messageKey="loginGateLike" />}
    </div>
  );
}
