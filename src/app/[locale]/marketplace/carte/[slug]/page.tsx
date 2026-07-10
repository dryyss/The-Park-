import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { HoloCard } from "@/components/cards/holo-card";
import { CatalogCardFrame } from "@/components/cards/catalog-card-frame";
import { AddToMarketplaceCartButton } from "@/components/marketplace/add-to-marketplace-cart-button";
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button";
import { OwnListingRowActions } from "@/components/marketplace/own-listing-row-actions";
import { UserHoverCard } from "@/components/profile/user-hover-card";
import { getCardSellListings } from "@/server/marketplace/marketplace.service";
import { getViewerUser } from "@/server/user/user.service";
import { getMarketplaceCartListingIds } from "@/server/marketplace-cart/marketplace-cart.service";

export const dynamic = "force-dynamic";

const AV_GRADIENTS: Record<string, string> = {
  L: "linear-gradient(135deg,#D81B60,#7A0F37)",
  M: "linear-gradient(135deg,#6FE3D0,#1F8C7A)",
  D: "linear-gradient(135deg,#4FA3FF,#1F4E8C)",
  S: "linear-gradient(135deg,#B05CFF,#5A1F8C)",
  T: "linear-gradient(135deg,#E8B23A,#8C641F)",
  H: "linear-gradient(135deg,#FF6B5E,#8C2F1F)",
};

export default async function CardSellersPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplace");
  const tc = await getTranslations("conditions");

  const [card, viewer] = await Promise.all([
    getCardSellListings(slug),
    getViewerUser(),
  ]);

  if (!card) notFound();

  const cartListingIds = viewer ? await getMarketplaceCartListingIds(viewer.id) : [];
  const cartSet = new Set(cartListingIds);

  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-8 pb-[60px]">
      {/* Retour */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={`/carte/${card.slug}`}
          className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-texte-dim uppercase transition hover:text-blanc-casse"
        >
          ← {card.name}
        </Link>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[1px] text-texte-faible uppercase transition hover:text-texte-dim"
        >
          {t("sellersBack")}
        </Link>
      </div>

      {/* En-tête carte */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        {/* Aperçu carte */}
        <div className="w-full max-w-[220px] shrink-0 self-center sm:self-auto">
          <CatalogCardFrame rarityColor={card.color}>
            <HoloCard
              src={card.image}
              alt={card.name}
              variant="none"
              className="rounded-none shadow-none"
            />
          </CatalogCardFrame>
        </div>

        {/* Infos carte */}
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[12px] font-bold text-texte-dim">
              <span style={{ color: card.color }}>{card.glyph}</span>
              <span>{card.rarityLabel}</span>
              <span className="text-texte-faible">·</span>
              <span>{card.numberLabel}</span>
              <span className="text-texte-faible">·</span>
              <span>{card.seasonLabel}</span>
            </div>
            <h1 className="font-display text-[clamp(28px,4vw,48px)] leading-tight -skew-x-3 uppercase text-blanc-casse">
              {card.name}
            </h1>
          </div>

          {/* Nombre d'offres */}
          <p className="text-[12.5px] font-bold text-texte-dim">
            {t("sellersCount", { count: card.sellers.length })}
          </p>
        </div>
      </div>

      {/* Liste vendeurs */}
      {card.sellers.length === 0 ? (
        <div className="mt-14 py-[60px] text-center">
          <div className="font-jp text-[32px] font-black text-charbon-500">何もない</div>
          <div className="mt-2 text-[14px] font-bold text-texte-faible">{t("sellersEmpty")}</div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {/* Header colonnes (desktop) — même grille que les lignes pour rester aligné */}
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_120px_120px_minmax(170px,auto)] gap-4 rounded-xl border border-charbon-600 bg-charbon-800/60 px-5 py-3 text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase sm:grid">
            <span>{t("sellersColSeller")}</span>
            <span>{t("sellersColCondition")}</span>
            <span>{t("sellersColVersion")}</span>
            <span className="text-right">{t("sellersColPrice")}</span>
            <span className="text-right">{t("sellersColAction")}</span>
          </div>

          {card.sellers.map((s, idx) => (
            <div
              key={s.listingId}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-charbon-500 bg-charbon-800 px-5 py-4 transition hover:border-charbon-400 sm:grid-cols-[minmax(0,1fr)_110px_120px_120px_minmax(170px,auto)] sm:items-center sm:gap-4"
            >
              {/* Vendeur */}
              <div className="flex items-center gap-2.5">
                <span
                  className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] text-white"
                  style={{ background: AV_GRADIENTS[s.seller.initial] ?? AV_GRADIENTS.L }}
                >
                  {s.seller.initial}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-extrabold text-blanc-casse">
                    <UserHoverCard slug={s.seller.slug}>{s.seller.name}</UserHoverCard>
                    {s.quantity > 1 && (
                      <span className="rounded bg-charbon-600 px-1.5 py-0.5 text-[10px] font-extrabold text-texte-dim">
                        ×{s.quantity}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-texte-dim">
                    ★ {s.seller.rating}
                    <span className="ml-1 text-texte-faible">({s.seller.reviews})</span>
                  </div>
                </div>
              </div>

              {/* État */}
              <div className="flex items-center gap-1.5 sm:justify-start">
                <span className="text-[10px] font-bold text-texte-faible uppercase sm:hidden">{t("sellersColCondition")} : </span>
                <span
                  className="rounded-md px-2.5 py-1 text-[10.5px] font-extrabold tracking-[1px] uppercase"
                  style={{ color: s.conditionColor, background: `${s.conditionColor}18` }}
                >
                  {tc(s.conditionCode)}
                </span>
              </div>

              {/* Version */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-texte-faible uppercase sm:hidden">{t("sellersColVersion")} : </span>
                <span className="rounded bg-charbon-600 px-2 py-0.5 text-[10.5px] font-bold text-texte-doux">
                  {s.versionLabel}
                </span>
              </div>

              {/* Prix */}
              <div className="flex items-center gap-1.5 sm:justify-end">
                <span className="text-[10px] font-bold text-texte-faible uppercase sm:hidden">{t("sellersColPrice")} : </span>
                {s.price === 0 ? (
                  <span className="text-[14px] font-bold text-texte-dim">{t("sellersTradeLabel")}</span>
                ) : (
                  <span className="font-display text-[22px] leading-none whitespace-nowrap text-blanc-casse">
                    {s.priceLabel}
                  </span>
                )}
              </div>

              {/* Action */}
              {(() => {
                const isOwn = viewer?.id === s.sellerId;
                if (isOwn) {
                  return (
                    <div className="sm:flex sm:justify-end">
                      <OwnListingRowActions listingId={s.listingId} />
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    {s.purchasable && (
                      <AddToMarketplaceCartButton
                        listingId={s.listingId}
                        inCart={cartSet.has(s.listingId)}
                      />
                    )}
                    <ContactSellerButton
                      sellerSlug={s.seller.slug}
                      locale={locale}
                      className="font-display -skew-x-3 rounded-lg border-[1.5px] border-carmin bg-carmin px-4 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap text-white uppercase transition hover:bg-carmin-alt"
                    >
                      {t("actionContact")}
                    </ContactSellerButton>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
