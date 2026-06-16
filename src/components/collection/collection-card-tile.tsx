import type { CollectionCard as Card } from "@/server/collection/collection.service";
import { HoloCard } from "@/components/cards/holo-card";
import { Link } from "@/i18n/navigation";
import { CollectionQuantityControls } from "@/components/collection/collection-quantity-controls";
import { versionTypeLabel } from "@/lib/card-versions";

export function CollectionCardTile({
  card,
  missingLabel,
  editable = false,
}: {
  card: Card;
  missingLabel: string;
  editable?: boolean;
}) {
  const missing = !card.owned;

  return (
    <div className={`animate-fade-up transition-[opacity,filter] ${missing ? "opacity-[0.88]" : ""}`}>
      <Link href={`/carte/${card.slug}`} className="block">
        <div
          className={[
            "relative aspect-[5/7] overflow-hidden rounded-xl border bg-charbon-700 shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-[filter,border-color]",
            missing ? "border-charbon-500/80 brightness-[0.68] saturate-[0.82]" : "border-white/10",
          ].join(" ")}
        >
          {card.image ? (
            <HoloCard
              src={card.image}
              alt={card.name}
              tilt={card.tilt}
              holo={card.holo}
              variant={card.owned ? "rainbow" : "none"}
              className="h-full w-full rounded-none border-0 shadow-none"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 bg-linear-to-b from-charbon-600 to-charbon-800 p-3.5">
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
              <div className="absolute inset-1.5 rounded-lg border border-dashed border-white/10" />
              <span className="font-display rounded bg-black/65 px-3 py-1 text-[10.5px] tracking-[2.5px] text-texte-doux uppercase backdrop-blur-sm">
                {missingLabel}
              </span>
            </div>
          )}
          {(card.hasFirstEdition || card.isPromo) && card.owned && (
            <span className="font-display absolute -left-1 top-2.5 -rotate-3 bg-carmin px-2.5 py-1 text-[9.5px] tracking-[1.5px] text-white shadow-[2px_2px_0_rgba(0,0,0,0.4)]">
              1ÈRE ÉDITION
            </span>
          )}
        </div>
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
      {editable && card.standardVariantId && (
        <div className={missing ? "opacity-70" : undefined}>
          <CollectionQuantityControls cardNumber={card.number} quantity={card.quantity} />
        </div>
      )}
    </div>
  );
}
