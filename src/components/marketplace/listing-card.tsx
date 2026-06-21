import { getTranslations, getLocale } from "next-intl/server";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { Link } from "@/i18n/navigation";
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button";
import { AddToMarketplaceCartButton } from "@/components/marketplace/add-to-marketplace-cart-button";
import { WishlistQuickAddButton } from "@/components/wishlist/wishlist-quick-add-button";
import type { MarketplaceCard } from "@/server/marketplace/marketplace.service";

const AV_GRADIENTS: Record<string, string> = {
  L: "linear-gradient(135deg,#D81B60,#7A0F37)",
  M: "linear-gradient(135deg,#6FE3D0,#1F8C7A)",
  D: "linear-gradient(135deg,#4FA3FF,#1F4E8C)",
  S: "linear-gradient(135deg,#B05CFF,#5A1F8C)",
  T: "linear-gradient(135deg,#E8B23A,#8C641F)",
  H: "linear-gradient(135deg,#FF6B5E,#8C2F1F)",
};

export async function ListingCard({
  listing,
  isOwnListing = false,
  inCart = false,
  viewerOwnsCard = false,
  inWishlist = false,
  isAuthenticated = false,
}: {
  listing: MarketplaceCard;
  isOwnListing?: boolean;
  inCart?: boolean;
  viewerOwnsCard?: boolean;
  inWishlist?: boolean;
  isAuthenticated?: boolean;
}) {
  const t = await getTranslations("marketplace");
  const tc = await getTranslations("conditions");
  const locale = await getLocale();
  const l = listing;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-charbon-500 bg-charbon-800 transition hover:border-charbon-400">
      <Link href={`/marketplace/carte/${l.slug}`} className="group relative block px-3.5 pt-3.5">
        <CatalogCardFrame rarityColor={l.color}>
          <HoloCard src={l.image} alt={l.name} variant="none" className="rounded-none shadow-none" />
        </CatalogCardFrame>
        <div className="pointer-events-none absolute inset-x-3.5 inset-y-0 flex items-center justify-center rounded-2xl bg-charbon-900/0 opacity-0 transition-all duration-200 group-hover:bg-charbon-900/55 group-hover:opacity-100">
          <span className="font-display -skew-x-3 rounded-lg bg-carmin px-3 py-1.5 text-[11px] tracking-[1.5px] text-white uppercase shadow-lg">
            Voir vendeurs
          </span>
        </div>
        <span
          className="absolute top-[26px] right-[26px] rounded-md bg-black/70 px-2.5 py-1 text-[10.5px] font-extrabold tracking-[1px] uppercase backdrop-blur-sm"
          style={{ color: l.conditionColor }}
        >
          {l.isWant ? `${t("minCondition")} ${tc(l.conditionCode)}` : tc(l.conditionCode)}
        </span>
        {l.isWant && (
          <span className="font-display absolute top-[26px] left-2 -rotate-3 bg-blanc-casse px-2.5 py-1 text-[10px] tracking-[1.5px] text-charbon shadow-[2px_2px_0_rgba(216,27,96,0.9)]">
            {t("wantedBadge").toUpperCase()}
          </span>
        )}
        {isOwnListing && (
          <span className="font-display absolute bottom-3 left-5 rounded bg-or/90 px-2 py-0.5 text-[9px] tracking-[1px] text-charbon">
            {t("ownListingBadge")}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 px-4 pt-3 pb-4">
        <div>
          <div className="text-[13px] leading-tight font-extrabold text-blanc-casse">{l.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-texte-dim">
            <span style={{ color: l.color }}>{l.glyph}</span>
            {l.numberLabel}
            <span className="rounded bg-charbon-600 px-2 py-0.5 text-[10.5px] text-texte-doux">{l.versionLabel}</span>
          </div>
        </div>

        <Link
          href={isOwnListing ? "/dashboard" : `/collectionneur/${l.seller.slug}`}
          className="flex items-center gap-2 rounded-[9px] border border-charbon-600 bg-charbon-700 px-2.5 py-1.5 transition hover:border-carmin"
        >
          <span
            className="font-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] text-white"
            style={{ background: AV_GRADIENTS[l.seller.initial] ?? AV_GRADIENTS.L }}
          >
            {l.seller.initial}
          </span>
          <span className="flex-1 truncate text-[11.5px] font-bold text-texte-doux">
            {isOwnListing ? t("ownListingYou") : l.seller.name}
          </span>
          {!isOwnListing && (
            <>
              <span className="text-[11px] font-extrabold whitespace-nowrap text-or">★ {l.seller.rating}</span>
              <span className="text-[10.5px] font-bold text-texte-faible">({l.seller.reviews})</span>
            </>
          )}
        </Link>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
                {l.isWant ? t("budgetCaption") : l.purchasable ? t("priceFixed") : t("priceCaption")}
              </div>
              <div className="font-display text-[21px] leading-tight text-blanc-casse">{l.priceLabel}</div>
            </div>
            {isOwnListing ? (
              <Link
                href="/dashboard"
                className="font-display -skew-x-3 rounded-lg border-[1.5px] border-or bg-or/10 px-3 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap text-or uppercase transition hover:bg-or/20"
              >
                {t("actionManage")}
              </Link>
            ) : l.purchasable ? (
              <div className="flex flex-col items-end gap-1.5">
                <AddToMarketplaceCartButton listingId={l.id} inCart={inCart} />
                <ContactSellerButton
                  sellerSlug={l.seller.slug}
                  locale={locale}
                  className="text-[10px] font-extrabold tracking-wide text-texte-faible uppercase transition hover:text-carmin"
                >
                  {t("actionContact")}
                </ContactSellerButton>
              </div>
            ) : (
              <ContactSellerButton
                sellerSlug={l.seller.slug}
                locale={locale}
                className={[
                  "font-display -skew-x-3 rounded-lg border-[1.5px] px-3 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap uppercase transition hover:-translate-y-0.5",
                  l.isWant
                    ? "border-charbon-400 text-blanc-casse hover:border-carmin"
                    : "border-carmin bg-carmin text-white hover:bg-carmin-alt",
                ].join(" ")}
              >
                {l.isWant ? t("actionPropose") : t("actionContact")}
              </ContactSellerButton>
            )}
          </div>
          {!isOwnListing && !viewerOwnsCard && (
            <WishlistQuickAddButton
              cardId={l.cardId}
              variantId={l.variantId}
              seasonId={l.seasonId}
              isAuthenticated={isAuthenticated}
              inWishlist={inWishlist}
            />
          )}
        </div>
      </div>
    </div>
  );
}
