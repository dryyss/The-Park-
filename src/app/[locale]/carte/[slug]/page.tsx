import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { OwnedVariantStack } from "@/components/cards/owned-variant-stack";
import { CardCommunityPhotos } from "@/components/collection/card-community-photos";
import { CardPriceHistory } from "@/components/cards/card-price-history";
import { getCardDetail } from "@/server/catalog/catalog.service";
import { getCardPriceHistory } from "@/server/catalog/price-history.service";
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button";
import { UserHoverCard } from "@/components/profile/user-hover-card";
import { getViewerUser, getAuthenticatedViewer } from "@/server/user/user.service";
import { CardMemberActions } from "@/components/cards/card-member-actions";
import { CardWantButton } from "@/components/cards/card-want-button";
import { CardLikeButton } from "@/components/cards/card-like-button";
import { getCardLikeMeta } from "@/server/card-like/card-like.service";
import { avatarGradient } from "@/lib/avatars";
import { conditionColor } from "@/lib/condition";
import { cardPageMetadata } from "@/lib/seo";
import { exchangeProposeHref } from "@/lib/exchange-links";
import { FEATURES } from "@/lib/features";
import { getCardSeoData } from "@/server/seo/seo.service";
import { BreadcrumbJsonLd, TradingCardJsonLd } from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const card = await getCardSeoData(slug);
  if (!card) return {};
  return cardPageMetadata(card, locale);
}

export default async function CartePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("card");
  const tc = await getTranslations("conditions");

  const viewer = await getViewerUser();
  const authenticated = await getAuthenticatedViewer();
  const card = await getCardDetail(slug, viewer?.id);
  if (!card) notFound();

  const likeMeta = await getCardLikeMeta(card.id, viewer?.id);
  const priceHistory = await getCardPriceHistory(card.id, { limit: 60 });

  const totalQty = card.versions.reduce((s, v) => s + v.quantity, 0);
  const ownedAny = totalQty > 0;
  const otherListings = card.listings.filter((l) => viewer?.id !== l.sellerId);
  const primarySeller = otherListings[0];
  const listingsHref = `/marketplace/carte/${card.slug}`;
  const exchangeHref = exchangeProposeHref({
    card: card.slug,
    recipient: primarySeller?.sellerSlug,
  });
  // Exemplaires possédés (variante + édition) empilés sur le hero, 1ère édition devant.
  const ownedVariantCards = card.versions
    .filter((v) => v.owned)
    .map((v) => ({
      variantId: v.variantId,
      image: v.image,
      label: v.label,
      editionLabel: v.editionLabel,
      isFirstEdition: v.isFirstEdition,
    }));
  return (
    <main className="mx-auto max-w-[1240px] page-pad pt-5 pb-[60px]">
      <TradingCardJsonLd
        card={{ name: card.name, slug: card.slug, image: card.image, description: card.description, rarityLabel: card.rarityLabel, seasonName: card.seasonName }}
        locale={locale}
      />
      <BreadcrumbJsonLd
        items={[
          { name: t("breadcrumbCollection"), url: `/${locale}/collection` },
          { name: card.name, url: `/${locale}/carte/${card.slug}` },
        ]}
      />
      <nav className="flex items-center gap-3 text-[12.5px] font-bold text-texte-dim">
        <Link href="/collection" className="transition hover:text-carmin">{t("breadcrumbCollection")}</Link>
        <span className="text-charbon-400">/</span>
        <span className="text-texte-doux">{card.rarityLabel}</span>
        <div className="flex-1" />
        {card.prevSlug && (
          <Link href={`/carte/${card.prevSlug}`} className="rounded-lg border border-charbon-500 px-3.5 py-2 transition hover:border-carmin">
            ← {t("prev")}
          </Link>
        )}
        {card.nextSlug && (
          <Link href={`/carte/${card.nextSlug}`} className="rounded-lg border border-charbon-500 px-3.5 py-2 transition hover:border-carmin">
            {t("next")} →
          </Link>
        )}
      </nav>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 lg:gap-4 xl:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
          <div className="relative min-w-0 flex-1 lg:sticky lg:top-[90px]">
            <OwnedVariantStack
              cards={ownedVariantCards}
              fallbackImage={card.image}
              alt={card.name}
              tilt={card.tilt}
              holo={card.holo}
              variant={card.variant}
              rarityColor={card.color}
              priority
            />
          </div>
          {card.communityPhotos.length > 0 && (
            <div className="min-w-0 flex-1">
              <CardCommunityPhotos photos={card.communityPhotos} />
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-charbon-600 px-3 py-1 text-[12px] font-extrabold text-texte-doux">N° {card.numberLabel}</span>
            <span className="flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-extrabold" style={{ background: `${card.color}22`, color: card.color }}>
              {card.glyph} {card.rarityLabel}
            </span>
            {card.country && (
              <span className="rounded-md border border-charbon-500 px-3 py-1 text-[12px] font-bold text-texte-dim">{card.country}</span>
            )}
          </div>

          <h1 className="font-display mt-4 text-[clamp(34px,4.4vw,56px)] leading-[0.96] -skew-x-3 uppercase text-blanc-casse [text-shadow:4px_4px_0_rgba(216,27,96,0.9)]">
            {card.name}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CardLikeButton
              cardId={card.id}
              initialCount={likeMeta.count}
              initialLiked={likeMeta.liked}
              isAuthenticated={!!authenticated}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {[
              { label: t("statQuote"), value: card.quoteLabel, accent: true },
              { label: t("statPower"), value: card.powerCh ?? "—" },
              { label: t("statWeight"), value: card.weightKg ? `${card.weightKg} kg` : "—" },
              { label: t("statOwned"), value: ownedAny ? String(totalQty) : t("no"), ok: ownedAny },
            ].map((s) => (
              <div key={s.label} className="min-w-[110px] rounded-[13px] border border-charbon-500 bg-charbon-800 px-4.5 py-3.5">
                <div className="text-[10px] font-extrabold tracking-[2px] text-texte-dim uppercase">{s.label}</div>
                <div
                  className={[
                    "font-display mt-1 text-[26px]",
                    s.accent ? "text-carmin" : s.ok === false ? "text-texte-faible" : s.ok ? "text-statut-succes" : "text-blanc-casse",
                  ].join(" ")}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {card.description && (
            <p className="mt-5 max-w-[620px] text-[15px] leading-[1.75] text-texte-doux">{card.description}</p>
          )}

          {card.versions.length > 1 && (
          <div className="mt-6">
            <div className="mb-2.5 text-[11px] font-extrabold tracking-[2.5px] text-texte-dim uppercase">{t("versionsTitle")}</div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {card.versions.map((v) => (
                <div
                  key={v.variantId}
                  className={[
                    "rounded-xl border-[1.5px] px-4 py-3",
                    v.owned ? "border-statut-succes/45 bg-statut-succes/8" : "border-charbon-500 bg-charbon-800",
                  ].join(" ")}
                >
                  <div className={`text-[13px] font-extrabold ${v.owned ? "text-blanc-casse" : "text-texte-dim"}`}>{v.label}</div>
                  <div className={`mt-1 text-[11.5px] font-bold ${v.owned ? "text-statut-succes" : "text-texte-faible"}`}>
                    {v.owned
                      ? v.reservedQuantity > 0
                        ? t("versionQtyReserved", { count: v.quantity, reserved: v.reservedQuantity })
                        : t("versionQty", { count: v.quantity })
                      : t("versionMissing")}
                  </div>
                  <div className="mt-1 text-[10.5px] font-bold text-texte-dim">
                    {v.editionLabel ? t("editionActive", { label: v.editionLabel }) : t("editionReedition")}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          <CardMemberActions
            cardId={card.id}
            seasonId={card.seasonId}
            seasonLabel={card.seasonLabel}
            isAuthenticated={!!authenticated}
            versions={card.versions}
          />

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href={listingsHref}
              className="font-display -skew-x-3 rounded-[10px] bg-carmin px-5.5 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.45)] transition hover:bg-carmin-alt"
            >
              {card.listings.length > 0 ? t("ctaListingsCount", { count: card.listings.length }) : t("ctaListings")}
            </Link>
            {FEATURES.exchange && (
              <Link
                href={exchangeHref}
                className="font-display -skew-x-3 rounded-[10px] border-[1.5px] border-charbon-400 px-5.5 py-3.5 text-[14px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin"
              >
                {t("ctaExchange")}
              </Link>
            )}
          </div>

          <CardWantButton
            versions={card.versions.map((v) => ({ variantId: v.variantId, label: v.label }))}
            isAuthenticated={!!authenticated}
          />
        </div>
      </div>

      {card.listings.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-[23px] tracking-[2px] -skew-x-3 uppercase text-blanc-casse [text-shadow:2px_2px_0_var(--color-carmin)]">
              {t("listingsTitle")}
            </h2>
            <span className="font-jp text-[12px] font-bold tracking-[2px] text-texte-faible">出品中</span>
            <span className="rounded-full border border-charbon-500 bg-charbon-800 px-2.5 py-1 text-[12px] font-extrabold text-carmin">
              {card.listings.length}
            </span>
            <Link
              href={`/marketplace/carte/${card.slug}`}
              className="ml-auto text-[11.5px] font-bold tracking-[1px] text-texte-dim uppercase transition hover:text-carmin"
            >
              {t("listingsViewAll")} →
            </Link>
          </div>

          {/* En-tête colonnes */}
          <div className="mb-2 hidden grid-cols-[1fr_90px_100px_80px_110px_180px] gap-3 px-4 text-[9.5px] font-extrabold tracking-[1.5px] text-texte-faible uppercase sm:grid">
            <span>{t("listingsColSeller")}</span>
            <span>{t("listingsColLang")}</span>
            <span>{t("listingsColCondition")}</span>
            <span>{t("listingsColProvenance")}</span>
            <span>{t("listingsColVersion")}</span>
            <span className="text-right">{t("listingsColPrice")}</span>
          </div>

          <div className="flex flex-col gap-2">
            {card.listings.map((l) => {
              const isOwn = viewer?.id === l.sellerId;
              const rowBase =
                "grid grid-cols-1 gap-2 rounded-[13px] border border-charbon-500 bg-charbon-800 px-4 py-3.5 transition hover:border-carmin sm:grid-cols-[1fr_90px_100px_80px_110px_180px] sm:items-center sm:gap-3";
              const inner = (
                <>
                  {/* Vendeur */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] text-white"
                      style={{ background: avatarGradient(l.sellerInitial) }}
                    >
                      {l.sellerInitial}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-extrabold text-blanc-casse">
                          {isOwn ? t("ownListingYou") : <UserHoverCard slug={l.sellerSlug}>{l.sellerName}</UserHoverCard>}
                        </span>
                        {!isOwn && <span className="text-[11px] font-bold text-or">★ {l.rating}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Langue */}
                  <div className="flex items-center gap-1 sm:justify-start">
                    <span className="text-[9px] font-bold text-texte-faible uppercase sm:hidden">{t("listingsColLang")} : </span>
                    <span className="rounded border border-charbon-500 px-2 py-0.5 font-mono text-[10px] font-extrabold text-texte-doux">
                      {l.language}
                    </span>
                  </div>

                  {/* État */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-texte-faible uppercase sm:hidden">{t("listingsColCondition")} : </span>
                    <span className="rounded-md px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.5px] uppercase"
                      style={{ color: conditionColor(l.conditionCode), background: `${conditionColor(l.conditionCode)}18` }}>
                      {tc(l.conditionCode)}
                    </span>
                  </div>

                  {/* Provenance */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-texte-faible uppercase sm:hidden">{t("listingsColProvenance")} : </span>
                    <span className="font-mono text-[11px] font-extrabold text-texte-dim">
                      {l.sellerCountry}
                    </span>
                  </div>

                  {/* Version */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-texte-faible uppercase sm:hidden">{t("listingsColVersion")} : </span>
                    <span className="rounded bg-charbon-600 px-2 py-0.5 text-[10px] font-bold text-texte-doux">
                      {l.versionLabel}
                    </span>
                  </div>

                  {/* Prix + actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <span className="font-display text-[19px] leading-none text-blanc-casse">{l.hasPrice ? l.price : "—"}</span>
                    {isOwn ? (
                      <Link
                        href="/dashboard"
                        className="font-display -skew-x-3 rounded-lg border border-or bg-or/10 px-3 py-2 text-[10.5px] tracking-[1px] text-or uppercase"
                      >
                        {t("actionManage")}
                      </Link>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {FEATURES.exchange && (
                          <Link
                            href={exchangeProposeHref({ card: card.slug, recipient: l.sellerSlug })}
                            className="font-display -skew-x-3 rounded-lg border-[1.5px] border-charbon-400 px-3 py-2 text-[10.5px] tracking-[1px] text-texte-doux uppercase transition hover:border-carmin"
                          >
                            {t("listingProposeExchange")}
                          </Link>
                        )}
                        <ContactSellerButton
                          sellerSlug={l.sellerSlug}
                          locale={locale}
                          className="font-display -skew-x-3 rounded-lg bg-carmin px-3 py-2 text-[10.5px] tracking-[1px] text-white uppercase"
                        >
                          {t("contact")}
                        </ContactSellerButton>
                      </div>
                    )}
                  </div>
                </>
              );
              return (
                <div key={l.id} className={rowBase}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <CardPriceHistory history={priceHistory} />
      </section>
    </main>
  );
}
