"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FilterPills } from "@/components/ui/filter-pills";
import { SkewButton } from "@/components/ui/skew-button";
import {
  notificationCategory,
  notificationVisual,
  relativeTimeLabel,
  type NotificationCategory,
} from "@/lib/notification-display";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/notification/notification.actions";
import type { NotificationItem } from "@/server/notification/notification.service";

const FILTER_KEYS: NotificationCategory[] = ["all", "trade", "market", "sale", "wallet", "badge"];

export function NotificationFeed({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationCategory>("all");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<NotificationCategory, number> = {
      all: items.length,
      trade: 0,
      market: 0,
      sale: 0,
      wallet: 0,
      badge: 0,
    };
    for (const n of items) {
      const cat = notificationCategory(n.type);
      if (cat !== "all") c[cat] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((n) => filter === "all" || notificationCategory(n.type) === filter),
    [items, filter],
  );

  const unreadCount = items.filter((n) => !n.read).length;

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

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="font-jp text-[30px] font-black text-charbon-500">通知なし</div>
        <p className="mt-2.5 text-[14px] font-bold text-texte-faible">{t("empty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="text-[12px] font-bold tracking-[4px] text-carmin uppercase">
          {unreadCount > 0 ? t("unreadKicker", { count: unreadCount }) : t("allReadKicker")}
        </p>
        {unreadCount > 0 && (
          <SkewButton variant="outline" disabled={pending} onClick={markAll}>
            {t("markAllRead")}
          </SkewButton>
        )}
      </div>

      <FilterPills
        activeKey={filter}
        onChange={(k) => setFilter(k as NotificationCategory)}
        items={FILTER_KEYS.map((k) => ({
          key: k,
          label: t(`filters.${k}`),
          count: counts[k],
        }))}
      />

      <div className="mt-3 flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-[13px] font-bold text-texte-dim">{t("emptyFilter")}</p>
        ) : (
          filtered.map((n) => {
            const vis = notificationVisual(n.type);
            return (
              <div
                key={n.id}
                className={[
                  "animate-pop flex items-center gap-3.5 rounded-[15px] border px-4 py-3.5 transition hover:translate-x-0.5 hover:border-carmin",
                  n.read ? "border-charbon-600 bg-charbon-900/80" : "border-carmin/30 bg-[#1c1a1f]",
                ].join(" ")}
              >
                <span
                  className="flex h-11 w-11 shrink-0 -rotate-3 items-center justify-center rounded-xl text-[19px]"
                  style={{ background: vis.iconBg, color: vis.iconColor }}
                >
                  {vis.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] leading-snug font-extrabold text-blanc-casse">
                    {t(`types.${n.titleKey}`)}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed font-semibold text-texte-muet">
                    {t(`types.${n.bodyKey}`, n.bodyParams ?? {})}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] font-bold whitespace-nowrap text-texte-faible">
                    {relativeTimeLabel(n.createdAt, locale)}
                  </span>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-carmin shadow-[0_0_8px_rgba(216,27,96,0.7)]" />
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => markOne(n.id)}
                      className="text-[10px] font-extrabold text-carmin hover:underline disabled:opacity-50"
                    >
                      {t("markRead")}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
