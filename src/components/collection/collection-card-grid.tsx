"use client";

import type { CollectionCard as Card } from "@/server/collection/collection.service";
import { CollectionCardTile } from "@/components/collection/collection-card-tile";
import { VirtualCardGrid } from "@/components/common/virtual-card-grid";
import { columnConfigFromCollectionCols, type ColumnBreakpointConfig } from "@/lib/responsive-columns";
import type { CollectionGridCols } from "@/lib/collection-grid";

export function CollectionCardGrid({
  cards,
  cols,
  missingLabel,
  isAuthenticated,
  wishlistCardIds,
  likeMeta,
}: {
  cards: Card[];
  cols: CollectionGridCols;
  missingLabel: string;
  isAuthenticated: boolean;
  wishlistCardIds: Set<string>;
  likeMeta: Record<string, { count: number; liked: boolean }>;
}) {
  const columnConfig: ColumnBreakpointConfig = columnConfigFromCollectionCols(cols);

  return (
    <VirtualCardGrid
      items={cards}
      columnConfig={columnConfig}
      getItemKey={(card) => card.slug}
      estimateExtraHeight={isAuthenticated ? 118 : 72}
      renderItem={(card) => (
        <CollectionCardTile
          card={card}
          missingLabel={missingLabel}
          showControls
          isAuthenticated={isAuthenticated}
          inWishlist={wishlistCardIds.has(card.cardId)}
          likeCount={likeMeta[card.cardId]?.count ?? 0}
          liked={likeMeta[card.cardId]?.liked ?? false}
        />
      )}
    />
  );
}
