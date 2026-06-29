"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { ListingDisplay } from "@/server/marketplace/marketplace.service";
import type { AuctionListItem } from "@/server/auction/auction.service";

function AuctionCountdown({ endsAt }: { endsAt: Date }) {
  const diff = Math.max(0, endsAt.getTime() - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span>{pad(h)}h {pad(m)}m {pad(s)}s</span>;
}

export function MarketTabs({
  listings,
  auctions,
  tabListings,
  tabAuctions,
  marketTitle,
  marketJp,
  bidLabel,
  noAuctions,
  seeAll,
}: {
  listings: ListingDisplay[];
  auctions: AuctionListItem[];
  tabListings: string;
  tabAuctions: string;
  marketTitle: string;
  marketJp: string;
  bidLabel: string;
  noAuctions: string;
  seeAll: string;
}) {
  const [tab, setTab] = useState<"listings" | "auctions">("listings");

  return (
    <div className="mt-[60px]">
      {/* Header */}
      <div className="mb-[18px] flex flex-wrap items-center gap-3.5">
        <h2 className="font-display text-[30px] tracking-[2px] skew-x-[-3deg] uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
          {marketTitle}
        </h2>
        <span className="font-jp text-[13px] font-bold tracking-[2px] text-texte-faible">{marketJp}</span>
        <div className="flex-1" />
        <Link
          href={tab === "auctions" ? "/encheres" : "/marketplace"}
          className="text-[13px] font-extrabold text-carmin transition hover:translate-x-[3px] hover:text-carmin-alt"
        >
          {seeAll} →
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-[11px] border border-charbon-500 bg-charbon-800 p-1.5">
        <button
          type="button"
          onClick={() => setTab("listings")}
          className={`font-display rounded-lg px-4 py-2 text-[12px] tracking-[1.5px] uppercase transition ${
            tab === "listings" ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"
          }`}
        >
          {tabListings}
        </button>
        <button
          type="button"
          onClick={() => setTab("auctions")}
          className={`font-display flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] tracking-[1.5px] uppercase transition ${
            tab === "auctions" ? "bg-carmin text-white" : "text-texte-dim hover:text-blanc-casse"
          }`}
        >
          {tabAuctions}
          {auctions.length > 0 && (
            <span className="text-[10px]">🔥</span>
          )}
        </button>
      </div>

      {/* Content */}
      {tab === "listings" && (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {listings.map((l) => (
            <Link key={l.id} href="/marketplace" className="block">
              <div className="relative overflow-hidden rounded-[14px] border border-charbon-500 bg-charbon-800">
                <div className="relative aspect-[5/7]">
                  {l.image ? (
                    <Image src={l.image} alt={l.name} fill className="object-cover" sizes="180px" />
                  ) : (
                    <div className="h-full w-full bg-charbon-700" />
                  )}
                  <span className="absolute top-1.5 right-1.5 z-10 text-[11px]" style={{ color: l.color }}>{l.glyph}</span>
                </div>
                <div className="p-2">
                  <div className="truncate text-[10.5px] font-extrabold text-texte-doux">{l.name}</div>
                  <div className="mt-1 text-[11px] font-extrabold text-carmin">{l.price}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === "auctions" && (
        <>
          {auctions.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-charbon-500 py-10 text-center text-[13px] font-bold text-texte-dim">
              {noAuctions}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {auctions.map((a) => (
                <Link key={a.id} href={`/encheres/${a.id}`} className="block">
                  <div className="overflow-hidden rounded-[14px] border border-charbon-500 bg-charbon-800 transition hover:border-carmin/50">
                    <div className="relative aspect-[5/7]">
                      {a.image ? (
                        <Image src={a.image} alt={a.cardName} fill className="object-cover" sizes="220px" />
                      ) : (
                        <div className="h-full w-full bg-charbon-700" />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="truncate text-[10.5px] font-extrabold text-texte-doux">{a.cardName}</div>
                      <div className="mt-1.5 text-[10px] font-bold text-texte-faible uppercase tracking-wide">{bidLabel}</div>
                      <div className="text-[12px] font-extrabold text-blanc-casse">{a.currentPrice}</div>
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-carmin/10 px-2 py-1.5 text-[10px] font-extrabold text-carmin">
                        <span>⏱</span>
                        <AuctionCountdown endsAt={new Date(a.endsAt)} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
