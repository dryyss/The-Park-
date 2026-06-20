import { getTranslations } from "next-intl/server";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { CardLikeButton } from "@/components/cards/card-like-button";
import { Link } from "@/i18n/navigation";
import { SectionHeading } from "./section-heading";
import type { CardDisplay } from "@/server/catalog/catalog.service";
import type { CardLikeMeta } from "@/server/card-like/card-like.service";

export async function FeaturedCards({
  cards,
  likeMeta,
  isAuthenticated,
}: {
  cards: CardDisplay[];
  likeMeta: Record<string, CardLikeMeta>;
  isAuthenticated: boolean;
}) {
  const t = await getTranslations("home");

  return (
    <div className="mt-14">
      <SectionHeading title={t("featuredTitle")} jp={t("featuredJp")}>
        <Link href="/collection" className="inline-block text-[13px] font-extrabold text-carmin transition hover:translate-x-[3px] hover:text-carmin-alt">
          {t("seeAllCollection")}
        </Link>
      </SectionHeading>
      <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const meta = likeMeta[c.id] ?? { count: 0, liked: false };
          return (
            <div key={c.slug} className="relative">
              <Link href={`/carte/${c.slug}`} className="block">
                <CatalogCardFrame rarityColor={c.color}>
                  <HoloCard src={c.image} alt={c.name} variant="none" className="rounded-none shadow-none" />
                </CatalogCardFrame>
                <div className="mt-[9px] flex items-center justify-between px-[3px]">
                  <span className="truncate text-[11.5px] font-extrabold text-texte-doux">{c.name}</span>
                  <span className="text-[12px]" style={{ color: c.color }}>{c.glyph}</span>
                </div>
              </Link>
              <CardLikeButton
                cardId={c.id}
                initialCount={meta.count}
                initialLiked={meta.liked}
                isAuthenticated={isAuthenticated}
                overlay
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
