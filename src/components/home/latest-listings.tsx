import { getTranslations } from "next-intl/server";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { Link } from "@/i18n/navigation";
import { SectionHeading } from "./section-heading";
import type { ListingDisplay } from "@/server/marketplace/marketplace.service";

export async function LatestListings({ listings }: { listings: ListingDisplay[] }) {
  const t = await getTranslations("home");

  if (listings.length === 0) return null;

  return (
    <div className="mt-[60px]">
      <SectionHeading title={t("latestTitle")} jp={t("latestJp")}>
        <Link href="/marketplace" className="inline-block text-[13px] font-extrabold text-carmin transition hover:translate-x-[3px] hover:text-carmin-alt">
          {t("seeAllMarket")}
        </Link>
      </SectionHeading>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {listings.map((l) => (
          <Link key={l.id} href="/marketplace" className="block">
            <div className="relative">
              <CatalogCardFrame rarityColor={l.color}>
                <HoloCard src={l.image} alt={l.name} variant="none" className="rounded-none shadow-none" />
              </CatalogCardFrame>
              <span className="absolute bottom-1.5 left-1.5 z-10 rounded-md bg-black/70 px-2 py-[3px] text-[10px] font-extrabold text-blanc-casse backdrop-blur-sm">
                {l.price}
              </span>
              <span className="absolute top-1.5 right-1.5 z-10 text-[11px]" style={{ color: l.color }}>{l.glyph}</span>
            </div>
            <div className="mt-[7px] truncate text-[10.5px] font-extrabold text-texte-doux">{l.name}</div>
            <div className="mt-px text-[9.5px] font-bold text-texte-dim">{l.sellerName}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
