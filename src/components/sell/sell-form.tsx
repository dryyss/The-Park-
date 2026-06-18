"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { OwnedCardForSale } from "@/server/marketplace/sell.service";
import { listCollectionItemAction } from "@/server/marketplace/marketplace.actions";
import { createAuctionAction } from "@/server/auction/auction.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

export function SellForm({
  cards,
  isAuthenticated = true,
}: {
  cards: OwnedCardForSale[];
  isAuthenticated?: boolean;
}) {
  const t = useTranslations("sell");
  const tc = useTranslations("conditions");
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [listingType, setListingType] = useState<"fixed" | "auction">("fixed");
  const [saleKind, setSaleKind] = useState<"SELL" | "TRADE" | "SELL_OR_TRADE">("SELL");
  const [price, setPrice] = useState("");
  const [auctionDays, setAuctionDays] = useState("3");
  const [reserve, setReserve] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);

  const card = cards[selected];

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-charbon-500 bg-charbon-800 p-10 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("noCards")}</p>
        <Link href="/collection" className="font-display mt-4 inline-block text-[13px] tracking-wide text-carmin uppercase">
          {t("goCollection")} →
        </Link>
      </div>
    );
  }

  function handlePublish() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    if (!card) return;
    // Un échange pur ne demande aucun prix ; vente / enchère / vente-ou-échange si.
    const tradeOnly = listingType === "fixed" && saleKind === "TRADE";
    let parsed: number | undefined;
    if (!tradeOnly) {
      parsed = parseFloat(price.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("VALIDATION");
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      if (listingType === "auction") {
        const parsedReserve = reserve.trim() ? parseFloat(reserve.replace(",", ".")) : undefined;
        const res = await createAuctionAction({
          variantId: card.variantId,
          startPrice: parsed!,
          durationDays: parseInt(auctionDays, 10),
          reservePrice: parsedReserve != null && Number.isFinite(parsedReserve) ? parsedReserve : undefined,
        });
        if (res.ok) {
          setSuccess(true);
          router.push("/encheres");
        } else {
          setError(res.error);
        }
        return;
      }
      const res = await listCollectionItemAction({
        variantId: card.variantId,
        condition: card.condition,
        type: saleKind,
        price: tradeOnly ? undefined : parsed,
      });
      if (res.ok) {
        setSuccess(true);
        router.push(saleKind === "TRADE" ? "/echanges" : "/marketplace");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="01" title={t("stepPickCard")} />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cards.map((cd, i) => (
              <button
                key={`${cd.variantId}:${cd.condition}`}
                type="button"
                onClick={() => setSelected(i)}
                className="w-[92px] shrink-0 cursor-pointer text-left"
              >
                <div
                  className={`relative aspect-[5/7] overflow-hidden rounded-[10px] border-[2.5px] shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 ${selected === i ? "border-carmin" : "border-charbon-500"}`}
                >
                  {cd.image && <Image src={cd.image} alt={cd.name} fill className="object-cover" sizes="92px" />}
                  <span
                    className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-display tracking-wide"
                    style={{ background: "rgba(0,0,0,0.7)", color: cd.color }}
                  >
                    {cd.glyph}
                  </span>
                </div>
                <div className="mt-1.5 truncate text-center text-[9.5px] font-extrabold text-texte-doux">{cd.shortName}</div>
                <div className="truncate text-center text-[8.5px] font-bold uppercase text-texte-faible">{tc(cd.condition)}</div>
                {cd.quantity > 1 && (
                  <div className="mt-0.5 text-center text-[9px] font-bold tabular-nums text-carmin">×{cd.quantity}</div>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="02" title={t("stepType")} />
          <div className="mb-4 flex gap-2.5">
            <TypeCard active={listingType === "fixed"} icon={<TagIcon />} title={t("typeFixed")} desc={t("typeFixedDesc")} onClick={() => setListingType("fixed")} />
            <TypeCard active={listingType === "auction"} icon={<GavelIcon />} title={t("typeAuction")} desc={t("typeAuctionDesc")} onClick={() => setListingType("auction")} />
          </div>
          {listingType === "fixed" && (
            <div className="mb-4">
              <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("saleKindLabel")}</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(["SELL", "TRADE", "SELL_OR_TRADE"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setSaleKind(kind)}
                    className={`rounded-[10px] border-[1.5px] px-3.5 py-2 text-[12px] font-extrabold transition ${
                      saleKind === kind ? "border-carmin bg-carmin/10 text-blanc-casse" : "border-charbon-500 text-texte-dim hover:border-charbon-400"
                    }`}
                  >
                    {kind === "SELL" ? t("saleKindSell") : kind === "TRADE" ? t("saleKindTrade") : t("saleKindBoth")}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={listingType === "fixed" && saleKind === "TRADE" ? "hidden" : undefined}>
            <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">
              {listingType === "auction" ? t("startPrice") : t("salePrice")}
            </label>
            <div className="relative mt-1.5">
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="font-display w-full rounded-[11px] border-[1.5px] border-charbon-500 bg-charbon px-4 py-3.5 pr-10 text-[20px] text-blanc-casse outline-none focus:border-carmin"
              />
              <span className="font-display pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[18px] text-texte-faible">€</span>
            </div>

            {listingType === "auction" && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("auctionDuration")}</label>
                  <select
                    value={auctionDays}
                    onChange={(e) => setAuctionDays(e.target.value)}
                    className="mt-1.5 w-full rounded-[11px] border-[1.5px] border-charbon-500 bg-charbon px-4 py-3 text-[14px] font-bold text-blanc-casse outline-none focus:border-carmin"
                  >
                    {["1", "3", "5", "7"].map((d) => (
                      <option key={d} value={d} className="bg-charbon-800">
                        {t("auctionDays", { count: Number(d) })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("reservePrice")}</label>
                  <div className="relative mt-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={reserve}
                      onChange={(e) => setReserve(e.target.value)}
                      placeholder={t("reserveOptional")}
                      className="w-full rounded-[11px] border-[1.5px] border-charbon-500 bg-charbon px-4 py-3 pr-9 text-[14px] font-bold text-blanc-casse outline-none focus:border-carmin"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-texte-faible">€</span>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-2 text-[11px] font-bold text-texte-faible">
              {listingType === "auction" ? t("auctionHint") : t("priceHint")}
            </p>
          </div>
        </section>

        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="03" title={t("stepPublish")} />
          <p className="mb-4 text-[12.5px] font-semibold text-texte-dim">{t("disclaimer")}</p>
          {success && <p className="mb-3 text-[13px] font-bold text-statut-succes">{t("publishSuccess")}</p>}
          {error && <p className="mb-3 text-[13px] font-bold text-neon-rouge">{t("publishError")}</p>}
          {showLoginGate && <div className="mb-3"><LoginGatePrompt compact messageKey="loginGateSell" /></div>}
          <button
            type="button"
            disabled={pending || success}
            onClick={handlePublish}
            className="font-display w-full -skew-x-3 rounded-[11px] bg-carmin px-6 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("publishing") : t("publish")}
          </button>
        </section>
      </div>

      {card && (
        <aside className="sticky top-24 rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <div className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("preview")}</div>
          <div className="relative mx-auto mt-3 aspect-[5/7] w-[180px] overflow-hidden rounded-xl shadow-[0_16px_32px_rgba(0,0,0,0.5)]">
            {card.image && <Image src={card.image} alt={card.name} fill className="object-cover" sizes="180px" />}
          </div>
          <div className="mt-3 text-center text-[14px] font-extrabold text-blanc-casse">{card.name}</div>
          <div className="mt-1 text-center text-[11px] font-bold text-texte-dim">
            #{String(card.number).padStart(2, "0")} · {card.versionLabel}
          </div>
          <div className="mt-2 text-center text-[12px] font-extrabold tabular-nums text-blanc-casse">
            {t("ownedQty", { count: card.quantity })}
            {card.availableQuantity < card.quantity && (
              <span className="ml-1 text-[10px] font-bold text-texte-faible">
                ({t("availableQty", { count: card.availableQuantity })})
              </span>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-center text-[12px] font-bold text-texte-doux">
            {t("quoteRef")} : {card.quoteValue} €
          </div>
        </aside>
      )}
    </div>
  );
}

function StepHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-2.5">
      <span className="font-display text-[15px] text-carmin -skew-x-3">{n}</span>
      <div className="font-display text-[17px] tracking-wide -skew-x-3 uppercase">{title}</div>
    </div>
  );
}

function TypeCard({
  active,
  icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-1 flex-col gap-1.5 rounded-[13px] border-[1.5px] p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-carmin bg-carmin/10" : "border-charbon-500 bg-charbon hover:border-charbon-400"}`}
    >
      <div
        className={`grid h-9 w-9 place-items-center rounded-[10px] transition-colors ${active ? "bg-carmin/20 text-carmin" : "bg-charbon-700 text-texte-dim group-hover:text-texte-doux"}`}
      >
        {icon}
      </div>
      <div className="text-[13.5px] font-extrabold text-blanc-casse">{title}</div>
      <div className="text-[11px] font-bold text-texte-dim">{desc}</div>
    </button>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GavelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}
