import { getTranslations, getLocale } from "next-intl/server";
import { ListingCardView, type ListingCardLabels } from "@/components/marketplace/listing-card-view";
import type { MarketplaceCard } from "@/server/marketplace/marketplace.service";

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

  const labels: ListingCardLabels = {
    minCondition: t("minCondition"),
    wantedBadge: t("wantedBadge"),
    ownListingBadge: t("ownListingBadge"),
    ownListingYou: t("ownListingYou"),
    budgetCaption: t("budgetCaption"),
    priceFixed: t("priceFixed"),
    priceCaption: t("priceCaption"),
    actionManage: t("actionManage"),
    actionContact: t("actionContact"),
    actionPropose: t("actionPropose"),
    viewSellers: t("viewSellers"),
  };

  return (
    <ListingCardView
      listing={listing}
      conditionLabel={tc(listing.conditionCode)}
      labels={labels}
      locale={locale}
      isOwnListing={isOwnListing}
      inCart={inCart}
      viewerOwnsCard={viewerOwnsCard}
      inWishlist={inWishlist}
      isAuthenticated={isAuthenticated}
    />
  );
}
