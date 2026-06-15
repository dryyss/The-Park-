import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import type { NotificationItem } from "@/server/notification/notification.service";

export async function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = await getTranslations("notifications");

  if (items.length === 0) {
    return <p className="py-16 text-center text-[14px] font-bold text-texte-dim">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((n) => (
        <div
          key={n.id}
          className={`flex gap-4 rounded-[15px] border-[1.5px] p-4 transition ${n.read ? "border-charbon-500 bg-charbon-800/60" : "border-carmin/40 bg-charbon-700"}`}
        >
          <span
            className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] text-white"
            style={{ background: avatarGradient(n.actorName?.charAt(0) ?? "?") }}
          >
            {(n.actorName ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-extrabold text-blanc-casse">{t(`types.${n.titleKey}`)}</p>
              {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-carmin" />}
            </div>
            <p className="mt-1 text-[13px] font-semibold text-texte-dim">
              {t(`types.${n.bodyKey}`, n.bodyParams ?? {})}
            </p>
            <p className="mt-2 text-[11px] font-bold text-texte-faible">
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(n.createdAt)}
            </p>
          </div>
        </div>
      ))}
      <p className="mt-4 text-center text-[12px] font-bold text-texte-faible">{t("markAllHint")}</p>
    </div>
  );
}
