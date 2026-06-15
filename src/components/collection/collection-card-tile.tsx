import type { CollectionCard as Card } from "@/server/collection/collection.service";
import { HoloCard } from "@/components/cards/holo-card";
import { Link } from "@/i18n/navigation";

export function CollectionCardTile({ card, missingLabel }: { card: Card; missingLabel: string }) {
  return (
    <Link href={`/carte/${card.slug}`} className="block animate-fade-up">
      <div className="relative aspect-[5/7] overflow-hidden rounded-xl border border-white/10 bg-charbon-700 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
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
            <span className="text-[32px] opacity-45" style={{ color: card.color }}>{card.glyph}</span>
            <span className="font-display text-center text-[14px] tracking-[1px] text-texte-faible uppercase">{card.name}</span>
          </div>
        )}
        {!card.owned && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-black/35 pb-3.5">
            <div className="absolute inset-1.5 rounded-lg border border-dashed border-white/15" />
            <span className="font-display rounded bg-black/65 px-3 py-1 text-[10.5px] tracking-[2.5px] text-texte-doux uppercase backdrop-blur-sm">
              {missingLabel}
            </span>
          </div>
        )}
        {card.quantity > 1 && (
          <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-2 py-0.5 text-[11.5px] font-extrabold text-blanc-casse backdrop-blur-sm">
            ×{card.quantity}
          </span>
        )}
        {card.isPromo && (
          <span className="font-display absolute -left-1 top-2.5 -rotate-3 bg-carmin px-2.5 py-1 text-[9.5px] tracking-[1.5px] text-white shadow-[2px_2px_0_rgba(0,0,0,0.4)]">
            1ÈRE ÉDITION
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-texte-dim">
          <span style={{ color: card.color }}>{card.glyph}</span>
          {card.numberLabel}
        </div>
        <div className="flex gap-1" title="Versions">
          <span className={`h-1.5 w-1.5 rounded-full border border-charbon-400 ${card.dots.standard ? "bg-current" : "bg-transparent"}`} style={{ color: card.color }} />
          <span className={`h-1.5 w-1.5 rounded-full border border-charbon-400 ${card.dots.reverse ? "bg-current" : "bg-transparent"}`} style={{ color: card.color }} />
          <span className={`h-1.5 w-1.5 rounded-full border border-charbon-400 ${card.dots.alternative ? "bg-current" : "bg-transparent"}`} style={{ color: card.color }} />
        </div>
      </div>
    </Link>
  );
}
