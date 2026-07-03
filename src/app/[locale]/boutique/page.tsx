import { setRequestLocale, getTranslations } from "next-intl/server";
import { getShopCatalog, getFeaturedShopProduct, type ShopCategory } from "@/server/shop/shop.service";
import { localePageMetadata } from "@/lib/seo-messages";
import {
  ProductTile,
  ShopCategoryFilters,
  ShopHero,
  ShopOfficialBanner,
} from "@/components/shop/shop-sections";
import { PromoBannerStrip } from "@/components/ads/promo-banners";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localePageMetadata("boutique", locale, "/boutique");
}

type SP = { cat?: string };

const VALID_CATS = new Set<ShopCategory>(["all", "display", "booster", "deck", "merch"]);

export default async function BoutiquePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("shop");

  const category = VALID_CATS.has(sp.cat as ShopCategory) ? (sp.cat as ShopCategory) : "all";
  const [featured, products] = await Promise.all([
    getFeaturedShopProduct(),
    getShopCatalog(category),
  ]);

  return (
    <main className="page-section pt-8">
      <ShopOfficialBanner />
      <PromoBannerStrip className="mt-6" />
      {featured && category === "all" && <ShopHero product={featured} />}

      <div className="mt-11 flex flex-wrap items-center gap-3.5">
        <h2 className="font-display text-[28px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
          {t("catalogTitle")}
        </h2>
        <span className="font-jp text-[12px] font-bold tracking-[2px] text-texte-faible">公式ストア</span>
        <div className="flex-1" />
        <ShopCategoryFilters category={category} />
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-center text-[14px] font-bold text-texte-dim">{t("empty")}</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
