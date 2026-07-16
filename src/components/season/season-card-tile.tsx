import type { SeasonCardRow } from "@/server/catalog/catalog.service";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { Link } from "@/i18n/navigation";
import { CollectionQuantityControls } from "@/components/collection/collection-quantity-controls";

export function SeasonCardTile({
  card,
  isAuthenticated,
}: {
  card: SeasonCardRow;
  isAuthenticated: boolean;
}) {
  return (
    <div>
      <Link href={`/carte/${card.slug}`} className="block">
        <CatalogCardFrame rarityColor={card.color}>
          <HoloCard
            src={card.image}
            alt={card.name}
            interactive={false}
            variant="none"
            className="rounded-none shadow-none"
          />
        </CatalogCardFrame>
        <div className="mt-2 flex items-center justify-between px-0.5">
          <span className="truncate text-[10.5px] font-extrabold text-texte-doux">{card.name}</span>
          <span style={{ color: card.color }}>{card.glyph}</span>
        </div>
      </Link>
      {card.standardVariantId && (
        <CollectionQuantityControls
          cardNumber={card.number}
          quantity={card.quantity}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}
