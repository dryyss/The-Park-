import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rarityMeta } from "@/lib/rarity";
import type { WishlistCard } from "@/server/wishlist/wishlist.service";

export async function WishlistGrid({ items }: { items: WishlistCard[] }) {
  const t = await getTranslations("wishlist");

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
        <Link href="/recherche" className="mt-4 inline-block text-[13px] font-extrabold text-carmin hover:underline">
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((card) => {
        const meta = rarityMeta(card.rarityCode);
        return (
          <Link
            key={card.id}
            href={`/carte/${card.slug}`}
            className="group rounded-[16px] border border-charbon-500 bg-charbon-800 p-3 transition hover:border-carmin"
          >
            <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-[10px] bg-charbon-700">
              {card.image && (
                <Image src={card.image} alt={card.name} fill className="object-cover transition group-hover:scale-105" sizes="200px" />
              )}
              <span
                className="absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {meta.glyph} #{String(card.number).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2.5 truncate text-[13px] font-extrabold text-blanc-casse">{card.name}</p>
            <p className="text-[11px] font-bold text-texte-dim">{card.quoteValue}</p>
            {card.note && <p className="mt-1 truncate text-[11px] italic text-texte-faible">{card.note}</p>}
          </Link>
        );
      })}
    </div>
  );
}
