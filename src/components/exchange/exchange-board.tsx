import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import { exchangeStatusStyle, EXCHANGE_STATUS_I18N } from "@/lib/exchange-status";
import { AuthGatedLink } from "@/components/auth/auth-gated-link";
import type {
  ExchangeCounts,
  ExchangeDetail,
  ExchangeInboxRole,
  ExchangeListItem,
  ExchangeTab,
  TradeOpportunity,
} from "@/server/exchange/exchange.service";
import { ExchangeActionsPanel } from "@/components/exchange/exchange-actions-panel";

function ExchangeTabs({
  tab,
  currentCount,
  doneCount,
  incomingCount,
  tabCurrentLabel,
  tabDoneLabel,
}: {
  tab: ExchangeTab;
  currentCount: number;
  doneCount: number;
  incomingCount: number;
  tabCurrentLabel: string;
  tabDoneLabel: string;
}) {
  return (
    <div className="mb-1 flex overflow-x-auto scroll-touch rounded-[11px] border border-charbon-500 bg-charbon-800 p-1.5 gap-0.5">
      <Link
        href="/echanges"
        className={`font-display relative shrink-0 rounded-lg px-3 py-2 text-[11px] tracking-[1px] uppercase transition sm:px-4.5 sm:py-2.5 sm:text-[13px] sm:tracking-[1.5px] ${tab === "current" ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"}`}
      >
        {tabCurrentLabel} · {currentCount}
        {incomingCount > 0 && tab !== "current" && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-or px-1 text-[9px] font-extrabold text-charbon">
            {incomingCount}
          </span>
        )}
      </Link>
      <Link
        href="/echanges?tab=done"
        className={`font-display shrink-0 rounded-lg px-3 py-2 text-[11px] tracking-[1px] uppercase transition sm:px-4.5 sm:py-2.5 sm:text-[13px] sm:tracking-[1.5px] ${tab === "done" ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"}`}
      >
        {tabDoneLabel} · {doneCount}
      </Link>
    </div>
  );
}

function ExchangeListRow({
  item,
  active,
  tab,
  statusLabel,
  actionLabel,
}: {
  item: ExchangeListItem;
  active: boolean;
  tab: ExchangeTab;
  statusLabel: string;
  actionLabel?: string;
}) {
  const st = exchangeStatusStyle(item.status);

  return (
    <Link
      href={`/echanges?tab=${tab}&id=${item.id}`}
      className={`flex items-center gap-3 rounded-[15px] border-[1.5px] p-3.5 transition hover:border-carmin ${active ? "border-carmin bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
    >
      <span
        className="font-display flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full text-[14px] text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
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
        {actionLabel && (
          <div className="mt-1 text-[10px] font-extrabold tracking-wide text-or uppercase">{actionLabel}</div>
        )}
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

function ExchangeListSection({
  title,
  items,
  selectedId,
  tab,
  statusLabels,
  actionLabel,
}: {
  title: string;
  items: ExchangeListItem[];
  selectedId?: string;
  tab: ExchangeTab;
  statusLabels: Record<string, string>;
  actionLabel?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="whitespace-nowrap text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{title}</span>
        <div className="h-px flex-1 bg-charbon-600" />
      </div>
      {items.map((item) => (
        <ExchangeListRow
          key={item.id}
          item={item}
          active={selectedId === item.id}
          tab={tab}
          statusLabel={statusLabels[EXCHANGE_STATUS_I18N[item.status]] ?? item.status}
          actionLabel={item.needsAction ? actionLabel : undefined}
        />
      ))}
    </div>
  );
}

async function ExchangeDetailPanel({
  detail,
  ownedCards = [],
}: {
  detail: ExchangeDetail;
  ownedCards?: { variantId: string; name: string; image?: string | null; availableQuantity?: number }[];
}) {
  const t = await getTranslations("exchanges");
  const st = exchangeStatusStyle(detail.status);
  const statusKey = EXCHANGE_STATUS_I18N[detail.status];

  return (
    <div className="overflow-hidden rounded-[20px] border border-charbon-500 bg-charbon-800">
      <div className="flex flex-wrap items-center gap-3 border-b border-charbon-600 bg-[radial-gradient(circle_at_6%_0%,rgba(216,27,96,0.14),transparent_60%)] px-4 py-4 sm:px-6 sm:py-4.5">
        <span
          className="font-display flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-xl text-[15px] text-white sm:h-11 sm:w-11 sm:text-[17px]"
          style={{ background: avatarGradient(detail.partnerInitial) }}
        >
          {detail.partnerInitial}
        </span>
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="font-display text-[15px] tracking-wide text-blanc-casse sm:text-[19px]">
            {t("exchangeWith", { id: detail.shortId, name: detail.partnerName.toUpperCase() })}
          </div>
          <div className="mt-0.5 text-[10.5px] font-bold text-texte-dim sm:text-[11.5px]">
            <span className="text-or">★ {detail.partnerRating}</span> ·{" "}
            {t("openedOn", { date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(detail.createdAt) })}{" "}
            ·{" "}
            <Link href={`/collectionneur/${detail.partnerSlug}`} className="font-extrabold text-carmin hover:text-carmin-alt">
              {t("viewBinder")} →
            </Link>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-row flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-col sm:items-end">
          {detail.conversationId && (
            <Link
              href={`/messages/${detail.conversationId}`}
              className="rounded-[11px] border border-carmin/50 bg-carmin/10 px-3.5 py-2 text-[11px] font-extrabold tracking-wide text-carmin uppercase transition hover:bg-carmin/20"
            >
              {t("openChat")} →
            </Link>
          )}
          <span
            className="rounded-full px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase"
            style={{ background: st.bg, color: st.color }}
          >
            {t(`status.${statusKey}`)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-charbon-600 p-6 md:border-r">
          <TradeSide title={t("youGive", { count: detail.gives.length })} cards={detail.gives} />
        </div>
        <div className="p-6">
          <TradeSide title={t("youReceive", { count: detail.gets.length })} cards={detail.gets} />
        </div>
      </div>

      {detail.message && !/^\w+\.\w+$/.test(detail.message) && (
        <div className="border-t border-charbon-600 px-6 py-4 text-[13px] font-semibold text-texte-doux">
          « {detail.message} »
        </div>
      )}

      {detail.secured && (
        <div className="mx-6 mb-6 rounded-lg border border-[rgba(94,217,154,0.3)] bg-[rgba(94,217,154,0.08)] px-3.5 py-2.5 text-center text-[12px] font-extrabold text-neon-vert">
          {t("securedShipping")}
        </div>
      )}

      <ExchangeActionsPanel detail={detail} ownedCards={ownedCards} />
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

async function OpportunityCard({
  opportunity: o,
  isAuthenticated,
}: {
  opportunity: TradeOpportunity;
  isAuthenticated: boolean;
}) {
  const t = await getTranslations("exchanges");
  const href = `/echanges/proposer?recipient=${encodeURIComponent(o.sellerSlug)}`;
  const card = (
    <div className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-charbon-500 bg-charbon-800 transition hover:border-carmin/60 hover:bg-charbon-700">
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-charbon-600">
        {o.cardImage ? (
          <Image src={o.cardImage} alt={o.cardName} fill className="object-cover transition group-hover:scale-[1.02]" sizes="(max-width:640px) 100vw, 280px" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl opacity-20">⇄</div>
        )}
        <span
          className={`absolute top-2.5 left-2.5 rounded-md px-2 py-1 text-[9px] font-extrabold tracking-wide uppercase ${
            o.type === "WANT" ? "bg-[rgba(94,217,154,0.92)] text-charbon" : "bg-[rgba(216,27,96,0.92)] text-white"
          }`}
        >
          {o.type === "WANT" ? t("listingWant") : t("listingTrade")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[13px] font-extrabold leading-snug text-blanc-casse">{o.cardName}</div>
          <div className="mt-1 text-[11px] font-bold text-texte-dim">{o.sellerName}</div>
          {o.priceLabel && <div className="mt-1.5 text-[11px] font-bold text-texte-faible">{o.priceLabel}</div>}
        </div>
        <span className="font-display w-full rounded-[10px] border border-carmin/40 bg-carmin/10 py-2.5 text-center text-[11px] tracking-[1px] text-carmin uppercase transition group-hover:bg-carmin group-hover:text-white">
          {t("proposeCta")}
        </span>
      </div>
    </div>
  );

  return isAuthenticated ? (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  ) : (
    <AuthGatedLink href={href} messageKey="loginGateExchanges" className="block h-full">
      {card}
    </AuthGatedLink>
  );
}

async function OpportunitiesPanel({
  opportunities,
  isAuthenticated,
}: {
  opportunities: TradeOpportunity[];
  isAuthenticated: boolean;
}) {
  const t = await getTranslations("exchanges");

  if (opportunities.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[20px] border border-charbon-500 bg-charbon-800">
      <div className="border-b border-charbon-600 bg-[radial-gradient(circle_at_0%_0%,rgba(216,27,96,0.12),transparent_55%)] px-6 py-5">
        <div className="font-display text-[11px] tracking-[2px] text-texte-faible uppercase">{t("openToTrade")}</div>
        <p className="mt-1 max-w-2xl text-[13px] font-semibold text-texte-dim">{t("openToTradeHint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {opportunities.map((o) => (
          <OpportunityCard key={o.listingId} opportunity={o} isAuthenticated={isAuthenticated} />
        ))}
      </div>
    </section>
  );
}

function ProposeNewButton({ isAuthenticated, label }: { isAuthenticated: boolean; label: string }) {
  const className =
    "font-display rounded-xl border-[1.5px] border-dashed border-charbon-400 p-3 text-center text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin hover:bg-carmin/10 hover:text-white";

  return isAuthenticated ? (
    <Link href="/echanges/proposer" className={className}>
      + {label}
    </Link>
  ) : (
    <AuthGatedLink href="/echanges/proposer" messageKey="loginGateExchanges" className={`block ${className}`}>
      + {label}
    </AuthGatedLink>
  );
}

function EmptyStateCard({ message }: { message: string }) {
  return (
    <div className="rounded-[15px] border border-dashed border-charbon-500 px-5 py-8 text-center">
      <div className="mb-2 text-3xl opacity-20">⇄</div>
      <p className="text-[13px] font-bold leading-relaxed text-texte-dim">{message}</p>
    </div>
  );
}

function SelectExchangePlaceholder({ message }: { message: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-[20px] border border-charbon-500 bg-charbon-800 p-8 text-center">
      <div className="mb-2 text-4xl opacity-10">⇄</div>
      <p className="max-w-sm text-[13px] font-bold leading-relaxed text-texte-dim">{message}</p>
    </div>
  );
}

function ExchangeListAside({
  list,
  tab,
  sections,
  selectedId,
  statusLabels,
  actionReplyLabel,
  sectionIncomingLabel,
  sectionOutgoingLabel,
  sectionActiveLabel,
  proposeNewLabel,
  isAuthenticated,
}: {
  list: ExchangeListItem[];
  tab: ExchangeTab;
  sections: { role: ExchangeInboxRole; items: ExchangeListItem[] }[] | null;
  selectedId?: string;
  statusLabels: Record<string, string>;
  actionReplyLabel: string;
  sectionIncomingLabel: string;
  sectionOutgoingLabel: string;
  sectionActiveLabel: string;
  proposeNewLabel: string;
  isAuthenticated: boolean;
}) {
  return (
    <aside className="flex flex-col gap-3">
      {sections ? (
        <>
          <ExchangeListSection
            title={sectionIncomingLabel}
            items={sections.find((s) => s.role === "incoming")?.items ?? []}
            selectedId={selectedId}
            tab={tab}
            statusLabels={statusLabels}
            actionLabel={actionReplyLabel}
          />
          <ExchangeListSection
            title={sectionOutgoingLabel}
            items={sections.find((s) => s.role === "outgoing")?.items ?? []}
            selectedId={selectedId}
            tab={tab}
            statusLabels={statusLabels}
          />
          <ExchangeListSection
            title={sectionActiveLabel}
            items={sections.find((s) => s.role === "active")?.items ?? []}
            selectedId={selectedId}
            tab={tab}
            statusLabels={statusLabels}
          />
        </>
      ) : (
        list.map((item) => (
          <ExchangeListRow
            key={item.id}
            item={item}
            active={selectedId === item.id}
            tab={tab}
            statusLabel={statusLabels[EXCHANGE_STATUS_I18N[item.status]] ?? item.status}
          />
        ))
      )}

      {tab === "current" && <ProposeNewButton isAuthenticated={isAuthenticated} label={proposeNewLabel} />}
    </aside>
  );
}

function groupCurrent(items: ExchangeListItem[]) {
  const order: ExchangeInboxRole[] = ["incoming", "outgoing", "active"];
  return order.map((role) => ({
    role,
    items: items.filter((i) => i.inboxRole === role),
  }));
}

export async function ExchangeBoard({
  tab,
  current,
  done,
  selected,
  counts,
  opportunities,
  ownedCards = [],
  isAuthenticated = true,
}: {
  tab: ExchangeTab;
  current: ExchangeListItem[];
  done: ExchangeListItem[];
  selected: ExchangeDetail | null;
  counts: ExchangeCounts;
  opportunities: TradeOpportunity[];
  ownedCards?: { variantId: string; name: string; image?: string | null; availableQuantity?: number }[];
  isAuthenticated?: boolean;
}) {
  const t = await getTranslations("exchanges");
  const list = tab === "done" ? done : current;
  const statusLabels = Object.fromEntries(
    Object.values(EXCHANGE_STATUS_I18N).map((key) => [key, t(`status.${key}`)]),
  );
  const sections = tab === "current" ? groupCurrent(current) : null;
  const hasExchanges = list.length > 0;
  const showMasterDetail = isAuthenticated && hasExchanges;
  const showOpportunities = tab === "current" && opportunities.length > 0 && !selected;

  const emptyMessage =
    tab === "done"
      ? t("emptyDone")
      : isAuthenticated
        ? t("emptyCurrentBrowse")
        : t("guestEmpty");

  return (
    <div className="mt-6 flex flex-col gap-6">
      <ExchangeTabs
        tab={tab}
        currentCount={current.length}
        doneCount={done.length}
        incomingCount={counts.incoming}
        tabCurrentLabel={t("tabCurrent")}
        tabDoneLabel={t("tabDone")}
      />

      {showMasterDetail ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <ExchangeListAside
            list={list}
            tab={tab}
            sections={sections}
            selectedId={selected?.id}
            statusLabels={statusLabels}
            actionReplyLabel={t("actionReply")}
            sectionIncomingLabel={t("sectionIncoming", { count: counts.incoming })}
            sectionOutgoingLabel={t("sectionOutgoing", { count: counts.outgoing })}
            sectionActiveLabel={t("sectionActive", { count: counts.active })}
            proposeNewLabel={t("proposeNew")}
            isAuthenticated={isAuthenticated}
          />
          {selected ? (
            <ExchangeDetailPanel detail={selected} ownedCards={ownedCards} />
          ) : (
            <SelectExchangePlaceholder message={t("selectExchange")} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(isAuthenticated || tab === "done" || !showOpportunities) && (
            <EmptyStateCard message={emptyMessage} />
          )}
          {isAuthenticated && tab === "current" && (
            <ProposeNewButton isAuthenticated={isAuthenticated} label={t("proposeNew")} />
          )}
        </div>
      )}

      {showOpportunities && (
        <OpportunitiesPanel opportunities={opportunities} isAuthenticated={isAuthenticated} />
      )}
    </div>
  );
}
