import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getMarketplaceListings,
  getMarketplaceFacets,
  type MarketIntent,
} from "@/server/marketplace/marketplace.service";
import { getViewerUser } from "@/server/user/user.service";
import { getMarketplaceCartItemCount } from "@/server/marketplace-cart/marketplace-cart.service";
import { MarketplaceFilters, type MarketParams } from "@/components/marketplace/marketplace-filters";
import { ListingCard } from "@/components/marketplace/listing-card";

export const dynamic = "force-dynamic";

type SearchParams = { intent?: string; rarity?: string; condition?: string; version?: string; q?: string };

function intentHref(p: MarketParams, intent: MarketIntent): string {
  // Changer d'onglet réinitialise les filtres spécifiques.
  const sp = new URLSearchParams({ intent });
  if (p.q) sp.set("q", p.q);
  return `/marketplace?${sp.toString()}`;
}

export default async function MarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("marketplace");

  const marketParams: MarketParams = {
    intent: sp.intent === "want" ? "want" : "sell",
    rarity: sp.rarity || undefined,
    condition: sp.condition || undefined,
    version: sp.version || undefined,
    q: sp.q || undefined,
  };

  const viewer = await getViewerUser();
  const [listings, facets, marketplaceCartCount] = await Promise.all([
    getMarketplaceListings(marketParams),
    getMarketplaceFacets(),
    viewer ? getMarketplaceCartItemCount(viewer.id) : Promise.resolve(0),
  ]);

  const tabs: { intent: MarketIntent; label: string; count: number }[] = [
    { intent: "sell", label: t("tabSell"), count: facets.sellCount },
    { intent: "want", label: t("tabWant"), count: facets.wantCount },
  ];

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      {/* En-tête */}
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="font-jp pointer-events-none absolute -top-7 right-0 hidden text-[130px] leading-none font-black text-blanc-casse/3 select-none lg:block">
          {t("jp")}
        </div>
        <div>
          <div className="mb-2.5 text-[12px] font-bold tracking-[4px] text-carmin uppercase">{t("kicker")}</div>
          <h1 className="font-display text-[clamp(44px,6vw,74px)] leading-[0.95] -skew-x-6 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
            {t("title")}
          </h1>
        </div>
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-charbon-500 bg-charbon-800 p-1.5">
            {tabs.map((tab) => {
              const active = marketParams.intent === tab.intent;
              return (
                <Link
                  key={tab.intent}
                  href={intentHref(marketParams, tab.intent)}
                  className={[
                    "font-display rounded-lg px-5 py-2.5 text-[13.5px] tracking-[1.5px] uppercase transition",
                    active ? "bg-carmin text-white" : "text-texte-muet hover:text-blanc-casse",
                  ].join(" ")}
                >
                  {tab.label} 〜 {tab.count}
                </Link>
              );
            })}
          </div>
          {marketParams.intent === "sell" && viewer && (
            <Link
              href="/marketplace/panier"
              className="font-display relative -skew-x-3 rounded-lg border-[1.5px] border-charbon-400 bg-charbon-800 px-5 py-2.5 text-[12.5px] tracking-[1.5px] whitespace-nowrap text-blanc-casse uppercase transition hover:border-carmin"
            >
              {t("viewCart")}
              {marketplaceCartCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-carmin px-1 text-[10px] font-extrabold text-white">
                  {marketplaceCartCount > 99 ? "99+" : marketplaceCartCount}
                </span>
              )}
            </Link>
          )}
          {marketParams.intent === "want" && (
            <Link
              href="/marketplace/recherche"
              className="font-display -skew-x-3 rounded-lg border-[1.5px] border-carmin bg-carmin/10 px-5 py-2.5 text-[12.5px] tracking-[1.5px] whitespace-nowrap text-carmin uppercase transition hover:bg-carmin hover:text-white"
            >
              {t("wantCtaPublish")}
            </Link>
          )}
        </div>
      </div>

      {/* Bannière enchères */}
      <Link
        href="/encheres"
        className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-charbon-500 bg-linear-to-r from-[#1F141A] to-charbon-800 px-5.5 py-4 transition hover:border-carmin"
      >
        <span className="flex h-11 w-11 shrink-0 -rotate-3 items-center justify-center rounded-xl bg-carmin/14 text-[22px]">🔨</span>
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-[18px] -skew-x-3 uppercase text-blanc-casse">{t("auctionTitle")}</span>
            <span className="flex items-center gap-1.5 rounded bg-carmin/16 px-2 py-0.5 text-[9.5px] font-extrabold text-carmin-neon">
              <span className="h-1.5 w-1.5 rounded-full bg-carmin-neon" />
              LIVE
            </span>
          </div>
          <div className="mt-0.5 text-[12.5px] font-bold text-texte-dim">{t("auctionDesc")}</div>
        </div>
        <span className="font-display -skew-x-3 rounded-lg bg-carmin px-5 py-3 text-[12.5px] tracking-[1.5px] whitespace-nowrap text-white">
          {t("auctionCta")}
        </span>
      </Link>

      {/* Filtres */}
      <MarketplaceFilters params={marketParams} facets={facets} locale={locale} />

      <p className="mt-3 text-[11.5px] font-bold text-texte-faible">{t("disclaimer")}</p>

      {/* Annonces */}
      {listings.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-4.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} isOwnListing={viewer?.id === l.sellerId} />
          ))}
        </div>
      ) : (
        <div className="py-[70px] text-center text-texte-faible">
          <div className="font-jp text-[34px] font-black text-charbon-500">{t("emptyJp")}</div>
          <div className="mt-2.5 text-[14px] font-bold">{t("emptyText")}</div>
          {marketParams.intent === "want" && (
            <Link
              href="/marketplace/recherche"
              className="font-display mt-5 inline-block -skew-x-3 rounded-lg bg-carmin px-6 py-3 text-[12.5px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt"
            >
              {t("wantCtaPublish")}
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
