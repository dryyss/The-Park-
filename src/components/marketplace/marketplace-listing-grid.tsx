"use client";

import { VirtualCardGrid } from "@/components/common/virtual-card-grid";
import { ListingCardView, type ListingCardLabels } from "@/components/marketplace/listing-card-view";
import { MARKETPLACE_COLUMN_CONFIG } from "@/lib/responsive-columns";
import type { MarketplaceCard } from "@/server/marketplace/marketplace.service";

export function MarketplaceListingGrid({
  listings,
  labels,
  conditionLabels,
  locale,
  cartListingIds,
  ownedCardNumbers,
  wishlistCardIds,
  viewerId,
  isAuthenticated,
}: {
  listings: MarketplaceCard[];
  labels: ListingCardLabels;
  conditionLabels: Record<string, string>;
  locale: string;
  cartListingIds: Set<string>;
  ownedCardNumbers: Set<number>;
  wishlistCardIds: Set<string>;
  viewerId?: string;
  isAuthenticated: boolean;
}) {
  return (
    <VirtualCardGrid
      items={listings}
      columnConfig={MARKETPLACE_COLUMN_CONFIG}
      getItemKey={(l) => l.id}
      estimateExtraHeight={248}
      renderItem={(l) => (
        <ListingCardView
          listing={l}
          conditionLabel={conditionLabels[l.conditionCode] ?? l.conditionCode}
          labels={labels}
          locale={locale}
          isOwnListing={viewerId === l.sellerId}
          inCart={cartListingIds.has(l.id)}
          viewerOwnsCard={ownedCardNumbers.has(l.number)}
          inWishlist={wishlistCardIds.has(l.cardId)}
          isAuthenticated={isAuthenticated}
        />
      )}
    />
  );
}
