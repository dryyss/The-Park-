import { getTranslations } from "next-intl/server";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { Link } from "@/i18n/navigation";
import { SectionHeading } from "./section-heading";
import type { CardDisplay } from "@/server/catalog/catalog.service";

export async function FeaturedCards({ cards }: { cards: CardDisplay[] }) {
  const t = await getTranslations("home");

  return (
    <div className="mt-14">
      <SectionHeading title={t("featuredTitle")} jp={t("featuredJp")}>
        <Link href="/collection" className="inline-block text-[13px] font-extrabold text-carmin transition hover:translate-x-[3px] hover:text-carmin-alt">
          {t("seeAllCollection")}
        </Link>
      </SectionHeading>
      <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.slug} href={`/carte/${c.slug}`} className="block">
            <CatalogCardFrame rarityColor={c.color}>
              <HoloCard src={c.image} alt={c.name} variant="none" className="rounded-none shadow-none" />
            </CatalogCardFrame>
            <div className="mt-[9px] flex items-center justify-between px-[3px]">
              <span className="truncate text-[11.5px] font-extrabold text-texte-doux">{c.name}</span>
              <span className="text-[12px]" style={{ color: c.color }}>{c.glyph}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
