import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rarityMeta } from "@/lib/rarity";
import type { AuctionListItem } from "@/server/auction/auction.service";
import { AuctionBidForm } from "@/components/auction/auction-bid-form";

function timeLeft(endsAt: Date): string {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export async function AuctionGrid({ auctions }: { auctions: AuctionListItem[] }) {
  const t = await getTranslations("auctions");

  if (auctions.length === 0) {
    return <p className="py-16 text-center text-[14px] font-bold text-texte-dim">{t("empty")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {auctions.map((a) => {
        const meta = rarityMeta(a.rarityCode);
        return (
          <Link
            key={a.id}
            href={`/encheres/${a.id}`}
            className="group rounded-[18px] border border-charbon-500 bg-charbon-800 p-4 transition hover:border-carmin"
          >
            <div className="flex gap-4">
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[10px] bg-charbon-700">
                {a.image && <Image src={a.image} alt={a.cardName} fill className="object-cover" sizes="80px" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[15px] font-extrabold text-blanc-casse">{a.cardName}</p>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: meta.color }}>
                    {meta.glyph}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-texte-dim">
                  {a.sellerName} · {t("bidCount", { count: a.bidCount })}
                </p>
                <p className="mt-2 font-display text-[22px] tracking-wide text-or">{a.currentPrice}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-md bg-charbon-700 px-2 py-1 font-mono text-[12px] font-bold text-carmin">
                    {timeLeft(a.endsAt)}
                  </span>
                  {a.antiSnipe && (
                    <span className="text-[10px] font-extrabold tracking-wide text-texte-faible uppercase">{t("antiSnipe")}</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export async function AuctionDetailPanel({ auction }: { auction: import("@/server/auction/auction.service").AuctionDetail }) {
  const t = await getTranslations("auctions");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
        <h2 className="font-display text-[24px] tracking-wide text-blanc-casse uppercase">{auction.cardName}</h2>
        <p className="mt-1 text-[13px] font-bold text-texte-dim">
          {t("seller")} ·{" "}
          <Link href={`/collectionneur/${auction.sellerSlug}`} className="text-carmin hover:underline">
            {auction.sellerName}
          </Link>
        </p>
        <p className="mt-6 font-display text-[36px] text-or">{auction.currentPrice}</p>
        <p className="text-[12px] font-bold text-texte-faible">{t("increment", { amount: auction.bidIncrement })}</p>
        {auction.status === "ACTIVE" ? (
          <AuctionBidForm auctionId={auction.id} minAmount={auction.minBidAmount} />
        ) : (
          <p className="mt-6 text-[13px] font-bold text-texte-dim">{t("ended")}</p>
        )}
      </div>
      <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
        <h3 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("bidHistory")}</h3>
        <div className="mt-4 flex flex-col gap-2">
          {auction.bids.length === 0 ? (
            <p className="text-[13px] font-bold text-texte-dim">{t("noBids")}</p>
          ) : (
            auction.bids.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg bg-charbon-700 px-3 py-2">
                <span className="text-[13px] font-extrabold text-blanc-casse">{b.bidderName}</span>
                <span className="font-display text-[15px] text-or">{b.amount}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
