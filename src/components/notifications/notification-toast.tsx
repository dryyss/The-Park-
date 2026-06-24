"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getPusherClient, isPusherClientConfigured, userChannelName } from "@/lib/pusher-client";

interface NotificationEvent {
  id: string;
  type: string;
}

interface Toast {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  href: string;
}

const BADGE_TITLE_KEY = "badgeUnlocked";
const BADGE_BODY_KEY = "badgeUnlockedBody";

export function LiveNotificationToast({ userId }: { userId: string }) {
  const t = useTranslations("notifications");
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!isPusherClientConfigured()) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(userChannelName(userId));

    const onNotification = (data: NotificationEvent) => {
      if (data.type !== "BADGE_UNLOCKED") return;

      const toast: Toast = {
        id: data.id,
        type: data.type,
        titleKey: BADGE_TITLE_KEY,
        bodyKey: BADGE_BODY_KEY,
        href: "/trophees",
      };

      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 6000);
    };

    channel.bind("notification", onNotification);
    return () => {
      channel.unbind("notification", onNotification);
    };
  }, [userId]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Link
          key={toast.id}
          href={toast.href}
          onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          className="animate-slide-in-right flex max-w-[320px] items-center gap-3 rounded-[14px] border border-[rgba(176,92,255,0.4)] bg-charbon-800 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:border-[rgba(176,92,255,0.7)]"
        >
          <span
            className="flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-xl text-[18px]"
            style={{ background: "rgba(176,92,255,0.15)", color: "#b05cff" }}
          >
            ★
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-blanc-casse">{t(`types.${toast.titleKey}`)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-texte-dim">{t("types.toastBadgeHint")}</p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            }}
            className="ml-1 shrink-0 text-[14px] text-texte-faible transition hover:text-blanc-casse"
          >
            ✕
          </button>
        </Link>
      ))}
    </div>
  );
}
