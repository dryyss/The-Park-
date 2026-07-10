import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";

/** Données minimales pour afficher une carte dans un emplacement de classeur. */
export interface ShowcaseCardData {
  name: string;
  image: string | null;
  color: string;
  glyph: string;
  numberLabel?: string;
}

/** Rendu d'une carte dans le Showroom (image holo ou repli glyphe). Présentation pure. */
export function ShowcaseCard({ card, className }: { card: ShowcaseCardData; className?: string }) {
  return (
    <CatalogCardFrame rarityColor={card.color} className={className}>
      {card.image ? (
        <HoloCard
          src={card.image}
          alt={card.name}
          interactive={false}
          variant="none"
          className="rounded-none shadow-none"
        />
      ) : (
        <div className="relative flex aspect-5/7 flex-col items-center justify-center gap-2 overflow-hidden bg-linear-to-b from-charbon-600 to-charbon-800 p-3">
          <span className="text-[28px] opacity-45" style={{ color: card.color }}>
            {card.glyph}
          </span>
          <span className="font-display text-center text-[12px] leading-tight tracking-[1px] text-texte-faible uppercase">
            {card.name}
          </span>
        </div>
      )}
    </CatalogCardFrame>
  );
}
