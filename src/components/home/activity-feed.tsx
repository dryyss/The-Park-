import { getTranslations, getFormatter } from "next-intl/server";
import { formatPrice } from "@/lib/format";
import type { ActivityItem } from "@/server/community/community.service";

export async function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const t = await getTranslations("home");
  const format = await getFormatter();

  if (items.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 px-[26px] py-6">
      <div className="mb-[18px] flex items-center gap-3">
        <h2 className="font-display text-[22px] tracking-[1.5px] skew-x-[-3deg] uppercase text-blanc-casse">{t("activityTitle")}</h2>
        <span className="font-jp text-[11px] font-bold tracking-[2px] text-texte-faible">{t("activityJp")}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-statut-succes">
          <span className="h-[7px] w-[7px] rounded-full bg-statut-succes shadow-[0_0_8px_rgba(94,217,154,0.8)]" />
          {t("live").toUpperCase()}
        </span>
      </div>
      <div className="flex flex-col">
        {items.map((a) => {
          const isWant = a.kind === "WANT";
          const messageKey = isWant ? "activityWant" : a.kind === "TRADE" ? "activityTrade" : "activityListing";
          return (
            <div key={a.id} className="flex items-center gap-3 border-b border-charbon-600 py-3 last:border-0">
              <span
                className="flex h-[38px] w-[38px] shrink-0 rotate-[-3deg] items-center justify-center rounded-[10px] text-base font-extrabold"
                style={
                  isWant
                    ? { background: "rgba(125,176,255,0.12)", color: "#7DB0FF" }
                    : { background: "rgba(94,217,154,0.12)", color: "#5ED99A" }
                }
              >
                {isWant ? "?" : "€"}
              </span>
              <div className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug text-texte-doux">
                {t(messageKey, { actor: a.actorName, card: a.cardName, price: formatPrice(a.price) })}
              </div>
              <span className="shrink-0 text-[10.5px] font-bold whitespace-nowrap text-texte-faible">
                {format.relativeTime(a.at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
