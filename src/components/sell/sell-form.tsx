"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OwnedCardForSale } from "@/server/marketplace/sell.service";

export function SellForm({ cards }: { cards: OwnedCardForSale[] }) {
  const t = useTranslations("sell");
  const [selected, setSelected] = useState(0);
  const [listingType, setListingType] = useState<"fixed" | "auction">("fixed");
  const [price, setPrice] = useState("");

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

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="01" title={t("stepPickCard")} />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cards.map((cd, i) => (
              <button
                key={cd.variantId}
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
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="02" title={t("stepType")} />
          <div className="mb-4 flex gap-2.5">
            <TypeCard
              active={listingType === "fixed"}
              emoji="🏷️"
              title={t("typeFixed")}
              desc={t("typeFixedDesc")}
              onClick={() => setListingType("fixed")}
            />
            <TypeCard
              active={listingType === "auction"}
              emoji="🔨"
              title={t("typeAuction")}
              desc={t("typeAuctionDesc")}
              onClick={() => setListingType("auction")}
            />
          </div>
          {listingType === "fixed" && (
            <div>
              <label className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("salePrice")}</label>
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
              <p className="mt-2 text-[11px] font-bold text-texte-faible">{t("priceHint")}</p>
            </div>
          )}
        </section>

        <section className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
          <StepHeader n="03" title={t("stepPublish")} />
          <p className="mb-4 text-[12.5px] font-semibold text-texte-dim">{t("disclaimer")}</p>
          <button
            type="button"
            disabled
            className="font-display w-full -skew-x-3 cursor-not-allowed rounded-[11px] bg-charbon-600 px-6 py-3.5 text-[14px] tracking-[1.5px] text-texte-faible uppercase"
          >
            {t("publishSoon")}
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
  emoji,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  emoji: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col gap-1.5 rounded-[13px] border-[1.5px] p-4 text-left transition ${active ? "border-carmin bg-carmin/10" : "border-charbon-500 bg-charbon hover:border-charbon-400"}`}
    >
      <div className="text-[20px]">{emoji}</div>
      <div className="text-[13.5px] font-extrabold text-blanc-casse">{title}</div>
      <div className="text-[11px] font-bold text-texte-dim">{desc}</div>
    </button>
  );
}
