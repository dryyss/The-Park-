"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/notification/notification.actions";
import type { NotificationItem } from "@/server/notification/notification.service";

export function NotificationActions({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unread = items.filter((n) => !n.read);

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="text-[12px] font-bold text-texte-dim">
        {unread.length > 0 ? t("unreadCount", { count: unread.length }) : t("allRead")}
      </p>
      {unread.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={markAll}
          className="text-[12px] font-extrabold text-carmin hover:underline disabled:opacity-50"
        >
          {t("markAllRead")}
        </button>
      )}
      <div className="hidden">
        {items.map((n) => (
          <button key={n.id} type="button" onClick={() => !n.read && markOne(n.id)}>
            mark
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotificationRowActions({ id, read }: { id: string; read: boolean }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (read) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationReadAction(id);
          router.refresh();
        })
      }
      className="mt-2 text-[11px] font-extrabold text-carmin hover:underline disabled:opacity-50"
    >
      {t("markRead")}
    </button>
  );
}
