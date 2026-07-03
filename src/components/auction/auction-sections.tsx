import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rarityMeta } from "@/lib/rarity";
import type { AuctionListItem } from "@/server/auction/auction.service";
import { AuctionBidForm } from "@/components/auction/auction-bid-form";
import { AuctionCountdown } from "@/components/auction/auction-countdown";
import { UserHoverCard } from "@/components/profile/user-hover-card";

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
                  <AuctionCountdown
                    endsAt={a.endsAt}
                    endedLabel={t("endedShort")}
                    className="rounded-md bg-charbon-700 px-2 py-1 font-mono text-[12px] font-bold text-carmin"
                  />
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

export async function AuctionDetailPanel({
  auction,
  viewerId = null,
}: {
  auction: import("@/server/auction/auction.service").AuctionDetail;
  viewerId?: string | null;
}) {
  const t = await getTranslations("auctions");
  const isWinner = viewerId != null && viewerId === auction.winnerId;
  const isSeller = viewerId != null && viewerId === auction.sellerId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Link
            href={`/carte/${auction.cardSlug}`}
            className="group relative aspect-3/4 w-40 shrink-0 overflow-hidden rounded-[14px] border border-charbon-500 bg-charbon-700"
          >
            {auction.image ? (
              <Image
                src={auction.image}
                alt={auction.cardName}
                fill
                className="object-cover transition group-hover:scale-105"
                sizes="160px"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center font-display text-[28px] text-charbon-500">
                {rarityMeta(auction.rarityCode).glyph}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[24px] tracking-wide text-blanc-casse uppercase">{auction.cardName}</h2>
            <p className="mt-1 text-[13px] font-bold text-texte-dim">
              {t("seller")} ·{" "}
              <UserHoverCard slug={auction.sellerSlug} className="text-carmin">
                {auction.sellerName}
              </UserHoverCard>
            </p>
            <p className="mt-6 font-display text-[36px] text-or">{auction.currentPrice}</p>
            <p className="text-[12px] font-bold text-texte-faible">{t("increment", { amount: auction.bidIncrement })}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("timeLeft")}</span>
          <AuctionCountdown
            endsAt={auction.endsAt}
            endedLabel={t("endedShort")}
            className="rounded-md bg-charbon-700 px-2.5 py-1 font-mono text-[14px] font-bold text-carmin"
          />
          {auction.reserveMet !== null && (
            <span
              className={`rounded-md px-2 py-1 text-[10.5px] font-extrabold tracking-wide uppercase ${
                auction.reserveMet ? "bg-neon-vert/15 text-neon-vert" : "bg-charbon-700 text-texte-faible"
              }`}
            >
              {auction.reserveMet ? t("reserveMet") : t("reserveNotMet")}
            </span>
          )}
        </div>

        {auction.status === "ACTIVE" ? (
          <AuctionBidForm auctionId={auction.id} minAmount={auction.minBidAmount} increment={auction.bidIncrementValue} />
        ) : (
          <div className="mt-6 rounded-[12px] border border-charbon-500 bg-charbon-700/50 p-4">
            <p className="text-[13px] font-extrabold text-blanc-casse">
              {auction.status === "SOLD" ? t("ended") : t("endedNoSale")}
            </p>
            {auction.winnerName && (
              <p className="mt-1 text-[12px] font-bold text-texte-dim">
                {t("winner", { name: auction.winnerName })} · {auction.currentPrice}
              </p>
            )}
            {/* Suivi post-enchère : visible uniquement par le gagnant et le vendeur. */}
            {auction.status === "SOLD" && (isWinner || isSeller) && (
              <div className="mt-4 rounded-[10px] border border-carmin/40 bg-carmin/8 p-4">
                <p className="font-display text-[14px] tracking-[1px] text-carmin uppercase">
                  {isWinner ? t("followupWonTitle") : t("followupSoldTitle")}
                </p>
                <p className="mt-1 text-[12.5px] font-bold text-texte-doux">
                  {isWinner ? t("followupWonBody") : t("followupSoldBody")}
                </p>
                {auction.conversationId && (
                  <Link
                    href={`/messages/${auction.conversationId}`}
                    className="font-display mt-3 inline-block -skew-x-3 rounded-lg bg-carmin px-5 py-2.5 text-[12px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt"
                  >
                    {isWinner ? t("followupContactSeller") : t("followupContactBuyer")}
                  </Link>
                )}
              </div>
            )}
          </div>
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
