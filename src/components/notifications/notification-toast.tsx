"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getPusherClient, isPusherClientConfigured, userChannelName } from "@/lib/pusher-client";

const TOAST_DURATION = 6000;

interface NotificationEvent {
  id: string;
  type: string;
  payload?: Record<string, string> | null;
}

interface BadgeToast {
  id: string;
  label: string;
  code: string;
  expiresAt: number;
}

export function LiveNotificationToast({ userId }: { userId: string }) {
  const t = useTranslations("notifications");
  const [toasts, setToasts] = useState<BadgeToast[]>([]);

  useEffect(() => {
    if (!isPusherClientConfigured()) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(userChannelName(userId));

    const onNotification = (data: NotificationEvent) => {
      if (data.type !== "BADGE_UNLOCKED") return;
      const label = data.payload?.label ?? t("types.badgeUnlocked");
      const code = data.payload?.code ?? "";
      const toast: BadgeToast = { id: data.id, label, code, expiresAt: Date.now() + TOAST_DURATION };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, TOAST_DURATION);
    };

    channel.bind("notification", onNotification);
    return () => {
      channel.unbind("notification", onNotification);
    };
  }, [userId, t]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-6 z-[200] flex flex-col gap-3">
      {toasts.map((toast) => (
        <BadgeToastCard
          key={toast.id}
          toast={toast}
          href="/trophees"
          onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          tLabel={t("types.toastBadgeTitle")}
        />
      ))}
    </div>
  );
}

function BadgeToastCard({
  toast,
  href,
  onClose,
  tLabel,
}: {
  toast: BadgeToast;
  href: string;
  onClose: () => void;
  tLabel: string;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const end = toast.expiresAt;
    const total = end - start;
    const raf = { id: 0 };

    const tick = () => {
      const remaining = end - Date.now();
      setProgress(Math.max(0, (remaining / total) * 100));
      if (remaining > 0) raf.id = requestAnimationFrame(tick);
    };
    raf.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.id);
  }, [toast.expiresAt]);

  return (
    <Link
      href={href}
      onClick={onClose}
      className="animate-slide-in-right group relative w-[300px] overflow-hidden rounded-[14px] border border-[rgba(176,92,255,0.35)] bg-charbon-800 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur-md transition hover:border-[rgba(176,92,255,0.7)]"
    >
      {/* Corps */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] transition group-hover:scale-110"
          style={{ background: "rgba(176,92,255,0.18)", color: "#b05cff" }}
        >
          ★
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold tracking-[1.5px] uppercase" style={{ color: "#b05cff" }}>
            {tLabel}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-extrabold text-blanc-casse">{toast.label}</p>
        </div>
        <button
          type="button"
          aria-label="Fermer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 shrink-0 text-[13px] text-texte-faible transition hover:text-blanc-casse"
        >
          ✕
        </button>
      </div>

      {/* Barre de progression */}
      <div className="h-[3px] w-full bg-charbon-600">
        <div
          className="h-full transition-none"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #b05cff, #7c3aed)",
          }}
        />
      </div>
    </Link>
  );
}
