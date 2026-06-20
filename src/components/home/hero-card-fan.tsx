import { HoloCard } from "@/components/cards/holo-card";
import { Link } from "@/i18n/navigation";
import type { CardDisplay } from "@/server/catalog/catalog.service";

const FAN_SLOTS = [
  {
    position:
      "left-[0%] top-[18%] z-[1] w-[44%] max-w-[200px] sm:max-w-[210px] lg:left-[0%] lg:top-[72px] lg:w-[38%] lg:max-w-[220px]",
    rotation: "-14deg",
    delay: "0s",
  },
  {
    position:
      "left-[26%] top-0 z-[3] w-[50%] max-w-[230px] sm:max-w-[250px] lg:left-[28%] lg:w-[44%] lg:max-w-[280px]",
    rotation: "-2deg",
    delay: "0.6s",
  },
  {
    position:
      "left-[52%] top-[20%] z-[2] w-[44%] max-w-[200px] sm:max-w-[210px] lg:left-[54%] lg:top-[88px] lg:w-[38%] lg:max-w-[220px]",
    rotation: "12deg",
    delay: "1.2s",
  },
] as const;

export function HeroCardFan({ cards }: { cards: CardDisplay[] }) {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[480px] sm:h-[360px] lg:mx-0 lg:h-[500px] lg:max-w-none">
      {cards.slice(0, 3).map((card, i) => {
        const slot = FAN_SLOTS[i];
        if (!slot) return null;

        return (
          <Link
            key={card.slug}
            href={`/carte/${card.slug}`}
            className={[
              "animate-floaty absolute block origin-center transition-[transform,z-index] duration-300 hover:z-[4] hover:scale-[1.04]",
              slot.position,
            ].join(" ")}
            style={{ ["--rot" as string]: slot.rotation, animationDelay: slot.delay }}
          >
            <HoloCard
              src={card.image}
              alt={card.name}
              variant="none"
              objectFit="contain"
              priority={i === 1}
              className="rounded-[14px] bg-transparent shadow-[0_20px_44px_rgba(0,0,0,0.58)]"
            />
          </Link>
        );
      })}
    </div>
  );
}
