import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rarityMeta } from "@/lib/rarity";
import type { AuctionListItem } from "@/server/auction/auction.service";
import {
  AUTO_BID_OPTION_FEE_EUR,
  getAuctionRegistration,
  hasAutoBidOption,
} from "@/server/auction/auction.mutations";
import { getUserAddresses } from "@/server/user/address.service";
import { SELECTABLE_SHIPPING_MODES } from "@/lib/shipping";
import { AuctionBidForm } from "@/components/auction/auction-bid-form";
import { AuctionRegistrationForm } from "@/components/auction/auction-registration-form";
import { AuctionCountdown } from "@/components/auction/auction-countdown";
import { UserHoverCard } from "@/components/profile/user-hover-card";

export async function AuctionGrid({ auctions }: { auctions: AuctionListItem[] }) {
  const t = await getTranslations("auctions");

  if (auctions.length === 0) {
    return <p className="text-texte-dim py-16 text-center text-[14px] font-bold">{t("empty")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {auctions.map((a) => {
        const meta = rarityMeta(a.rarityCode);
        return (
          <Link
            key={a.id}
            href={`/encheres/${a.id}`}
            className="group border-charbon-500 bg-charbon-800 hover:border-carmin rounded-[18px] border p-4 transition"
          >
            <div className="flex gap-4">
              <div className="bg-charbon-700 relative h-28 w-20 shrink-0 overflow-hidden rounded-[10px]">
                {a.image && (
                  <Image
                    src={a.image}
                    alt={a.cardName}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-blanc-casse truncate text-[15px] font-extrabold">
                    {a.cardName}
                  </p>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: meta.color }}>
                    {meta.glyph}
                  </span>
                </div>
                <p className="text-texte-dim text-[11px] font-bold">
                  {a.sellerName} · {t("bidCount", { count: a.bidCount })}
                </p>
                <p className="font-display text-or mt-2 text-[22px] tracking-wide">
                  {a.currentPrice}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <AuctionCountdown
                    endsAt={a.endsAt}
                    endedLabel={t("endedShort")}
                    className="bg-charbon-700 text-carmin rounded-md px-2 py-1 font-mono text-[12px] font-bold"
                  />
                  {a.antiSnipe && (
                    <span className="text-texte-faible text-[10px] font-extrabold tracking-wide uppercase">
                      {t("antiSnipe")}
                    </span>
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
  // L'option payante est attachée au couple (membre, enchère) : un visiteur non
  // connecté se voit toujours proposer l'achat, la garde reste côté serveur.
  const autoBidUnlocked = viewerId != null && (await hasAutoBidOption(viewerId, auction.id));
  // Inscription obligatoire avant de miser : tant qu'elle manque, on montre le
  // formulaire d'expédition à la place du formulaire de mise.
  const [registration, addresses] = viewerId
    ? await Promise.all([getAuctionRegistration(viewerId, auction.id), getUserAddresses(viewerId)])
    : [null, []];
  const shippingModes = SELECTABLE_SHIPPING_MODES.map((m) => ({ code: m.code, feeEur: m.feeEur }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="border-charbon-500 bg-charbon-800 rounded-[18px] border p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Link
            href={`/carte/${auction.cardSlug}`}
            className="group border-charbon-500 bg-charbon-700 relative aspect-3/4 w-40 shrink-0 overflow-hidden rounded-[14px] border"
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
              <span className="font-display text-charbon-500 absolute inset-0 flex items-center justify-center text-[28px]">
                {rarityMeta(auction.rarityCode).glyph}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-blanc-casse text-[24px] tracking-wide uppercase">
              {auction.cardName}
            </h2>
            <p className="text-texte-dim mt-1 text-[13px] font-bold">
              {t("seller")} ·{" "}
              <UserHoverCard slug={auction.sellerSlug} className="text-carmin">
                {auction.sellerName}
              </UserHoverCard>
            </p>
            <p className="font-display text-or mt-6 text-[36px]">{auction.currentPrice}</p>
            <p className="text-texte-faible text-[12px] font-bold">
              {t("increment", { amount: auction.bidIncrement })}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-texte-dim text-[11px] font-extrabold tracking-wide uppercase">
            {t("timeLeft")}
          </span>
          <AuctionCountdown
            endsAt={auction.endsAt}
            endedLabel={t("endedShort")}
            className="bg-charbon-700 text-carmin rounded-md px-2.5 py-1 font-mono text-[14px] font-bold"
          />
          {auction.reserveMet !== null && (
            <span
              className={`rounded-md px-2 py-1 text-[10.5px] font-extrabold tracking-wide uppercase ${
                auction.reserveMet
                  ? "bg-neon-vert/15 text-neon-vert"
                  : "bg-charbon-700 text-texte-faible"
              }`}
            >
              {auction.reserveMet ? t("reserveMet") : t("reserveNotMet")}
            </span>
          )}
        </div>

        {auction.status === "ACTIVE" ? (
          <>
            {viewerId && !isSeller && (
              <AuctionRegistrationForm
                auctionId={auction.id}
                addresses={addresses}
                shippingModes={shippingModes}
                current={registration}
              />
            )}
            {/* Le visiteur non connecté voit le formulaire de mise : c'est lui qui
                déclenche l'invite de connexion. Le membre inscrit peut miser. */}
            {(viewerId == null || registration != null) && (
              <AuctionBidForm
                auctionId={auction.id}
                minAmount={auction.minBidAmount}
                increment={auction.bidIncrementValue}
                autoBidUnlocked={autoBidUnlocked}
                autoBidFeeEur={AUTO_BID_OPTION_FEE_EUR}
                shippingCostEur={registration?.shippingCostEur ?? 0}
              />
            )}
          </>
        ) : (
          <div className="border-charbon-500 bg-charbon-700/50 mt-6 rounded-[12px] border p-4">
            <p className="text-blanc-casse text-[13px] font-extrabold">
              {auction.status === "SOLD" ? t("ended") : t("endedNoSale")}
            </p>
            {auction.winnerName && (
              <p className="text-texte-dim mt-1 text-[12px] font-bold">
                {t("winner", { name: auction.winnerName })} · {auction.currentPrice}
              </p>
            )}
            {/* Suivi post-enchère : visible uniquement par le gagnant et le vendeur. */}
            {auction.status === "SOLD" && (isWinner || isSeller) && (
              <div className="border-carmin/40 bg-carmin/8 mt-4 rounded-[10px] border p-4">
                <p className="font-display text-carmin text-[14px] tracking-[1px] uppercase">
                  {isWinner ? t("followupWonTitle") : t("followupSoldTitle")}
                </p>
                <p className="text-texte-doux mt-1 text-[12.5px] font-bold">
                  {isWinner ? t("followupWonBody") : t("followupSoldBody")}
                </p>
                {auction.conversationId && (
                  <Link
                    href={`/messages/${auction.conversationId}`}
                    className="font-display bg-carmin hover:bg-carmin-alt mt-3 inline-block -skew-x-3 rounded-lg px-5 py-2.5 text-[12px] tracking-[1.5px] text-white uppercase transition"
                  >
                    {isWinner ? t("followupContactSeller") : t("followupContactBuyer")}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-charbon-500 bg-charbon-800 rounded-[18px] border p-5">
        <h3 className="font-display text-blanc-casse text-[16px] tracking-wide uppercase">
          {t("bidHistory")}
        </h3>
        <div className="mt-4 flex flex-col gap-2">
          {auction.bids.length === 0 ? (
            <p className="text-texte-dim text-[13px] font-bold">{t("noBids")}</p>
          ) : (
            auction.bids.map((b) => (
              <div
                key={b.id}
                className="bg-charbon-700 flex items-center justify-between rounded-lg px-3 py-2"
              >
                <span className="text-blanc-casse text-[13px] font-extrabold">{b.bidderName}</span>
                <span className="font-display text-or text-[15px]">{b.amount}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
