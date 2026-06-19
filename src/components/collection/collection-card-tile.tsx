import type { CollectionCard as Card } from "@/server/collection/collection.service";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { Link } from "@/i18n/navigation";
import { CollectionQuantityControls } from "@/components/collection/collection-quantity-controls";
import { versionTypeLabel } from "@/lib/card-versions";

export function CollectionCardTile({
  card,
  missingLabel,
  showControls = false,
  isAuthenticated = false,
}: {
  card: Card;
  missingLabel: string;
  showControls?: boolean;
  isAuthenticated?: boolean;
}) {
  const missing = !card.owned;

  return (
    <div className={`transition-[opacity,filter] ${missing ? "opacity-[0.88]" : ""}`}>
      <Link href={`/carte/${card.slug}`} className="block">
        <CatalogCardFrame rarityColor={card.color}>
          <div
            className={[
              "relative transition-[filter]",
              missing ? "brightness-[0.68] saturate-[0.82]" : "",
            ].join(" ")}
          >
            {card.image ? (
              <HoloCard
                src={card.image}
                alt={card.name}
                interactive={false}
                variant="none"
                className="rounded-none shadow-none"
              />
            ) : (
              <div className="relative flex aspect-[5/7] flex-col items-center justify-center gap-2.5 overflow-hidden bg-linear-to-b from-charbon-600 to-charbon-800 p-3.5">
                <span className="text-[32px] opacity-45" style={{ color: card.color }}>
                  {card.glyph}
                </span>
                <span className="font-display text-center text-[14px] tracking-[1px] text-texte-faible uppercase">
                  {card.name}
                </span>
              </div>
            )}
            {missing && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-black/48 pb-3.5">
                <span className="font-display rounded bg-black/65 px-3 py-1 text-[10.5px] tracking-[2.5px] text-texte-doux uppercase backdrop-blur-sm">
                  {missingLabel}
                </span>
              </div>
            )}
          </div>
        </CatalogCardFrame>
      </Link>
      <div className={`mt-2 flex items-center justify-between px-0.5 ${missing ? "opacity-55" : ""}`}>
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-texte-dim">
          <span style={{ color: card.color }}>{card.glyph}</span>
          {card.numberLabel}
        </div>
        <div className="flex gap-1" title="Versions">
          {card.dots.length > 1 &&
            card.dots.map((dot) => (
              <span
                key={dot.code}
                title={versionTypeLabel(dot.code)}
                className={`h-1.5 w-1.5 rounded-full border border-charbon-400 ${dot.owned ? "bg-current" : "bg-transparent"}`}
                style={{ color: card.color }}
              />
            ))}
        </div>
      </div>
      {showControls && card.standardVariantId && (
        <div className={missing ? "opacity-70" : undefined}>
          <CollectionQuantityControls
            cardNumber={card.number}
            quantity={card.quantity}
            isAuthenticated={isAuthenticated}
          />
        </div>
      )}
    </div>
  );
}
