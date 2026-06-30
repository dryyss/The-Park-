"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fetchUserHoverCardAction } from "@/server/profile/hovercard.actions";
import type { UserHoverCard as UserHoverCardData } from "@/server/profile/profile.service";
import { countryFlag, countryName } from "@/lib/countries";

// Cache mémoire par slug — partagé entre toutes les instances, évite de refetch au survol.
const cache = new Map<string, UserHoverCardData | null>();

const LANGUAGE_LABELS: Record<string, string> = {
  FR: "Français",
  EN: "English",
  JP: "日本語",
  DE: "Deutsch",
  US: "English (US)",
};

const OPEN_DELAY = 220;
const CLOSE_DELAY = 140;

export function UserHoverCard({
  slug,
  children,
  className,
}: {
  slug: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("hovercard");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<UserHoverCardData | null | undefined>(cache.get(slug));
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (cache.has(slug)) {
      setData(cache.get(slug));
      return;
    }
    const result = await fetchUserHoverCardAction(slug);
    cache.set(slug, result);
    setData(result);
  }, [slug]);

  const scheduleOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => {
      setOpen(true);
      void load();
    }, OPEN_DELAY);
  }, [load]);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={scheduleClose}
    >
      <Link href={`/collectionneur/${slug}`} className="outline-none hover:text-carmin focus-visible:text-carmin">
        {children}
      </Link>

      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-2 w-[280px] cursor-default rounded-2xl border border-charbon-500 bg-charbon-800 p-4 text-left shadow-2xl shadow-black/40"
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
        >
          {data === undefined ? (
            <HoverSkeleton />
          ) : data === null ? (
            <p className="text-[12px] font-bold text-texte-dim">{t("unavailable")}</p>
          ) : (
            <HoverContent data={data} />
          )}
        </div>
      )}
    </span>
  );
}

function HoverSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-charbon-600" />
        <div className="flex-1">
          <div className="h-3.5 w-24 rounded bg-charbon-600" />
          <div className="mt-2 h-2.5 w-16 rounded bg-charbon-700" />
        </div>
      </div>
      <div className="mt-4 h-2.5 w-full rounded bg-charbon-700" />
      <div className="mt-2 h-2.5 w-2/3 rounded bg-charbon-700" />
    </div>
  );
}

function HoverContent({ data }: { data: UserHoverCardData }) {
  const t = useTranslations("hovercard");
  const locale = useLocale();
  const flag = countryFlag(data.country);
  const country = countryName(data.country, locale);
  const lang = LANGUAGE_LABELS[data.language] ?? data.language;
  const memberSince = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(data.memberSince);

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-carmin/15 text-[16px] font-black text-carmin">
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            data.initial
          )}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[14px] font-extrabold text-blanc-casse">
            {data.displayName}
            {data.staffRole && <span className="rounded bg-carmin px-1.5 py-0.5 text-[8.5px] font-black tracking-wide text-white uppercase">Staff</span>}
          </p>
          <p className="text-[11px] font-bold text-texte-dim">{t("memberSince", { date: memberSince })}</p>
        </div>
      </div>

      {/* Pays · langue · note */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] font-bold text-texte-doux">
        {data.country && (
          <span title={t("country")}>
            {flag} {country}
          </span>
        )}
        <span title={t("language")}>🗣 {lang}</span>
        {data.reviews > 0 && (
          <span title={t("rating")}>
            ★ {data.rating} <span className="text-texte-faible">({data.reviews})</span>
          </span>
        )}
      </div>

      {/* Catalogue */}
      {data.collection && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold tracking-wide text-texte-dim uppercase">
            <span>{t("catalog")}</span>
            <span className="text-texte-doux">
              {data.collection.owned}/{data.collection.total} · {data.collection.pct}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-charbon-600">
            <div className="h-full rounded-full bg-carmin" style={{ width: `${data.collection.pct}%` }} />
          </div>
        </div>
      )}

      {/* Succès */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10.5px] font-extrabold tracking-wide text-texte-dim uppercase">
          <span>{t("achievements")}</span>
          <span className="text-texte-doux">{data.badgeCount}</span>
        </div>
        {data.topBadges.length > 0 ? (
          <div className="mt-1.5 flex gap-1.5">
            {data.topBadges.map((b) => (
              <span
                key={b.code}
                title={b.name}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-charbon-700 text-[14px]"
              >
                {b.icon}
              </span>
            ))}
            {data.badgeCount > data.topBadges.length && (
              <span className="flex h-7 items-center px-1.5 text-[11px] font-bold text-texte-faible">
                +{data.badgeCount - data.topBadges.length}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[11px] font-semibold text-texte-faible">{t("noBadges")}</p>
        )}
      </div>

      {/* Annonces + CTA */}
      <div className="mt-3.5 flex items-center justify-between border-t border-charbon-600 pt-3">
        <span className="text-[11px] font-bold text-texte-dim">{t("listings", { count: data.listingCount })}</span>
        <Link
          href={`/collectionneur/${data.slug}`}
          className="font-display rounded-lg bg-carmin px-3 py-1.5 text-[10.5px] tracking-wide text-white uppercase transition hover:bg-carmin-alt"
        >
          {t("viewProfile")}
        </Link>
      </div>
    </div>
  );
}
