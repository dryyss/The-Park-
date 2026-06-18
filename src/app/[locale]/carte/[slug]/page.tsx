import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { OwnedVariantStack } from "@/components/cards/owned-variant-stack";
import { getCardDetail } from "@/server/catalog/catalog.service";
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button";
import { getViewerUser, getAuthenticatedViewer } from "@/server/user/user.service";
import { CardMemberActions } from "@/components/cards/card-member-actions";
import { avatarGradient } from "@/lib/avatars";
import { isFirstEditionLabel } from "@/lib/card-edition";

export const dynamic = "force-dynamic";

export default async function CartePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("card");
  const tc = await getTranslations("conditions");

  const viewer = await getViewerUser();
  const authenticated = await getAuthenticatedViewer();
  const card = await getCardDetail(slug, viewer?.id);
  if (!card) notFound();

  const totalQty = card.versions.reduce((s, v) => s + v.quantity, 0);
  const ownedAny = totalQty > 0;
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
  const showFirstEditionBadge =
    card.versions.some((v) => v.isFirstEdition) ||
    card.versions.some((v) => isFirstEditionLabel(v.catalogEditionLabel));

  return (
    <main className="mx-auto max-w-[1240px] px-7 pt-5 pb-[60px]">
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

      <div className="mt-6 grid items-start gap-11 lg:grid-cols-[380px_1fr]">
        <div className="lg:sticky lg:top-[90px]">
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
          {showFirstEditionBadge && (
            <span className="font-display absolute left-0 top-3.5 -rotate-3 bg-carmin px-3 py-1 text-[11px] tracking-[1.5px] text-white">
              {t("firstEditionBadge")}
            </span>
          )}
          <p className="mt-3 text-center text-[11.5px] font-bold text-texte-faible">{t("holoHint")}</p>
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
                  key={v.code}
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
            <Link href="/marketplace" className="font-display -skew-x-3 rounded-[10px] bg-carmin px-5.5 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.45)] transition hover:bg-carmin-alt">
              {t("ctaListings")}
            </Link>
            <Link href="/echanges" className="font-display -skew-x-3 rounded-[10px] border-[1.5px] border-charbon-400 px-5.5 py-3.5 text-[14px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin">
              {t("ctaExchange")}
            </Link>
          </div>
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
          </div>
          <div className="flex flex-col gap-2">
            {card.listings.map((l) => {
              const isOwn = viewer?.id === l.sellerId;
              const rowClass =
                "flex items-center gap-3.5 rounded-[13px] border border-charbon-500 bg-charbon-800 px-4 py-3 transition hover:border-carmin";
              const inner = (
                <>
                  <span
                    className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] text-white"
                    style={{ background: avatarGradient(l.sellerInitial) }}
                  >
                    {l.sellerInitial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold text-blanc-casse">
                      {isOwn ? t("ownListingYou") : l.sellerName}{" "}
                      {!isOwn && <span className="text-[11px] text-or">★ {l.rating}</span>}
                    </div>
                    <div className="text-[11px] font-bold text-texte-dim">
                      {l.versionLabel} · {tc(l.conditionCode)}
                    </div>
                  </div>
                  <div className="font-display text-[19px] text-blanc-casse">{l.price}</div>
                  <span
                    className={`font-display -skew-x-3 rounded-lg px-3.5 py-2 text-[11px] tracking-[1px] uppercase ${
                      isOwn ? "border border-or bg-or/10 text-or" : "bg-carmin text-white"
                    }`}
                  >
                    {isOwn ? t("actionManage") : t("contact")}
                  </span>
                </>
              );
              return isOwn ? (
                <Link key={l.id} href="/dashboard" className={rowClass}>
                  {inner}
                </Link>
              ) : (
                <ContactSellerButton
                  key={l.id}
                  sellerSlug={l.sellerSlug}
                  locale={locale}
                  className={`${rowClass} w-full text-left`}
                >
                  {inner}
                </ContactSellerButton>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
