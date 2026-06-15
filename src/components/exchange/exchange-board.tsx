import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import { exchangeStatusStyle, EXCHANGE_STATUS_I18N } from "@/lib/exchange-status";
import type { ExchangeDetail, ExchangeListItem, ExchangeTab } from "@/server/exchange/exchange.service";

function ExchangeTabs({
  tab,
  currentCount,
  doneCount,
}: {
  tab: ExchangeTab;
  currentCount: number;
  doneCount: number;
}) {
  return (
    <div className="mb-1 flex rounded-[11px] border border-charbon-500 bg-charbon-800 p-1.5 gap-0.5">
      <Link
        href="/echanges"
        className={`font-display rounded-lg px-4.5 py-2.5 text-[13px] tracking-[1.5px] uppercase transition ${tab === "current" ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"}`}
      >
        EN COURS · {currentCount}
      </Link>
      <Link
        href="/echanges?tab=done"
        className={`font-display rounded-lg px-4.5 py-2.5 text-[13px] tracking-[1.5px] uppercase transition ${tab === "done" ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"}`}
      >
        TERMINÉS · {doneCount}
      </Link>
    </div>
  );
}

function ExchangeListRow({
  item,
  active,
  tab,
  statusLabel,
}: {
  item: ExchangeListItem;
  active: boolean;
  tab: ExchangeTab;
  statusLabel: string;
}) {
  const st = exchangeStatusStyle(item.status);

  return (
    <Link
      href={`/echanges?tab=${tab}&id=${item.id}`}
      className={`flex items-center gap-3 rounded-[15px] border-[1.5px] p-3.5 transition hover:border-carmin ${active ? "border-carmin bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
    >
      <span
        className="font-display flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full text-[14px] text-white"
        style={{ background: avatarGradient(item.partnerInitial) }}
      >
        {item.partnerInitial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-blanc-casse">
          {item.partnerName}{" "}
          <span className="text-[11px] font-bold text-texte-faible">· {item.shortId}</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] font-bold text-texte-dim">{item.summary}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="rounded-md px-2 py-1 text-[10px] font-extrabold tracking-wide uppercase"
          style={{ background: st.bg, color: st.color }}
        >
          {statusLabel}
        </span>
        <span className="text-[10.5px] font-bold text-texte-faible">
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(item.createdAt)}
        </span>
      </div>
    </Link>
  );
}

async function ExchangeDetailPanel({ detail }: { detail: ExchangeDetail }) {
  const t = await getTranslations("exchanges");
  const st = exchangeStatusStyle(detail.status);
  const statusKey = EXCHANGE_STATUS_I18N[detail.status];

  return (
    <div className="overflow-hidden rounded-[20px] border border-charbon-500 bg-charbon-800">
      <div className="flex items-center gap-3 border-b border-charbon-600 bg-[radial-gradient(circle_at_6%_0%,rgba(216,27,96,0.14),transparent_60%)] px-6 py-4.5">
        <span
          className="font-display flex h-11 w-11 shrink-0 -rotate-3 items-center justify-center rounded-xl text-[17px] text-white"
          style={{ background: avatarGradient(detail.partnerInitial) }}
        >
          {detail.partnerInitial}
        </span>
        <div className="flex-1">
          <div className="font-display text-[19px] tracking-wide text-blanc-casse">
            {t("exchangeWith", { id: detail.shortId, name: detail.partnerName.toUpperCase() })}
          </div>
          <div className="mt-0.5 text-[11.5px] font-bold text-texte-dim">
            <span className="text-or">★ {detail.partnerRating}</span> ·{" "}
            {t("openedOn", { date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(detail.createdAt) })}{" "}
            ·{" "}
            <Link href={`/collectionneur/${detail.partnerSlug}`} className="font-extrabold text-carmin hover:text-carmin-alt">
              {t("viewBinder")} →
            </Link>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase"
          style={{ background: st.bg, color: st.color }}
        >
          {t(`status.${statusKey}`)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-charbon-600 p-6 md:border-r">
          <TradeSide title={t("youGive", { count: detail.gives.length })} cards={detail.gives} />
        </div>
        <div className="p-6">
          <TradeSide title={t("youReceive", { count: detail.gets.length })} cards={detail.gets} />
        </div>
      </div>

      {detail.message && (
        <div className="border-t border-charbon-600 px-6 py-4 text-[13px] font-semibold text-texte-doux">
          « {detail.message} »
        </div>
      )}

      {detail.secured && (
        <div className="mx-6 mb-6 rounded-lg border border-[rgba(94,217,154,0.3)] bg-[rgba(94,217,154,0.08)] px-3.5 py-2.5 text-center text-[12px] font-extrabold text-neon-vert">
          {t("securedShipping")}
        </div>
      )}

      <div className="border-t border-charbon-600 px-6 py-4">
        <div className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("doubleValidation")}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-[11px] border border-charbon-500 bg-charbon-700 p-3">
            <div className="text-[11.5px] font-extrabold text-texte-doux">{t("you")}</div>
            <div className="mt-0.5 text-[12px] font-extrabold text-neon-vert">{t("validationPending")}</div>
          </div>
          <div className="rounded-[11px] border border-charbon-500 bg-charbon-700 p-3">
            <div className="text-[11.5px] font-extrabold text-texte-doux">{detail.partnerName}</div>
            <div className="mt-0.5 text-[12px] font-extrabold text-texte-dim">{t("validationPending")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeSide({ title, cards }: { title: string; cards: { name: string; image: string | null; meta: string }[] }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((g) => (
          <div key={`${g.name}-${g.meta}`}>
            <div className="relative aspect-[5/7] overflow-hidden rounded-[10px] shadow-[0_10px_22px_rgba(0,0,0,0.45)]">
              {g.image ? (
                <Image src={g.image} alt={g.name} fill className="object-cover" sizes="120px" />
              ) : (
                <div className="h-full w-full bg-charbon-600" />
              )}
            </div>
            <div className="mt-1.5 text-[10.5px] leading-snug font-extrabold text-blanc-casse">{g.name}</div>
            <div className="text-[9.5px] font-bold text-texte-dim">{g.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function ExchangeBoard({
  tab,
  current,
  done,
  selected,
}: {
  tab: ExchangeTab;
  current: ExchangeListItem[];
  done: ExchangeListItem[];
  selected: ExchangeDetail | null;
}) {
  const t = await getTranslations("exchanges");
  const list = tab === "done" ? done : current;

  return (
    <>
      <ExchangeTabs tab={tab} currentCount={current.length} doneCount={done.length} />
      <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-2.5">
          {list.length === 0 ? (
            <div className="rounded-[15px] border border-dashed border-charbon-500 p-8 text-center text-[13px] font-bold text-texte-dim">
              {tab === "done" ? t("emptyDone") : t("emptyCurrent")}
            </div>
          ) : (
            list.map((item) => (
              <ExchangeListRow
                key={item.id}
                item={item}
                active={selected?.id === item.id}
                tab={tab}
                statusLabel={t(`status.${EXCHANGE_STATUS_I18N[item.status]}`)}
              />
            ))
          )}
          <Link
            href="/marketplace"
            className="font-display rounded-xl border-[1.5px] border-dashed border-charbon-400 p-3.5 text-center text-[12.5px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin hover:bg-carmin/10 hover:text-white"
          >
            + {t("proposeNew")}
          </Link>
        </div>

        {selected ? (
          <ExchangeDetailPanel detail={selected} />
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-[20px] border border-charbon-500 bg-charbon-800 p-8 text-[13px] font-bold text-texte-dim">
            {t("selectExchange")}
          </div>
        )}
      </div>
    </>
  );
}
