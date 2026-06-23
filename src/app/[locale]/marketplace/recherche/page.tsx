import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getViewerUser } from "@/server/user/user.service";
import { getSeasonCards } from "@/server/catalog/catalog.service";
import { WantForm, type WantCatalogCard } from "@/components/marketplace/want-form";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";

export const dynamic = "force-dynamic";

export default async function MarketplaceRecherchePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("want");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;
  const seasonCards = await getSeasonCards();
  const cards: WantCatalogCard[] = seasonCards
    .filter((c) => c.standardVariantId)
    .map((c) => ({
      variantId: c.standardVariantId,
      slug: c.slug,
      name: c.name,
      number: c.number,
      image: c.image,
      glyph: c.glyph,
      color: c.color,
    }));

  return (
    <main className="mx-auto max-w-[1120px] page-pad pt-7 pb-[60px]">
      <nav className="flex items-center gap-3 text-[12.5px] font-bold text-texte-dim">
        <Link href="/marketplace?intent=want" className="hover:text-carmin">
          {t("breadcrumbMarket")}
        </Link>
        <span className="text-charbon-400">/</span>
        <span className="text-texte-doux">{t("breadcrumbWant")}</span>
      </nav>

      <h1 className="font-display mt-4 text-[clamp(34px,4.5vw,52px)] leading-[0.95] -skew-x-3 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
        {t("title")}
      </h1>
      <p className="mt-3.5 text-[13.5px] font-bold text-texte-doux">{t("subtitle")}</p>

      {!isAuthenticated && <GuestAuthBanner messageKey="loginGateExchanges" />}

      <div className="mt-6">
        <WantForm cards={cards} isAuthenticated={isAuthenticated} />
      </div>
    </main>
  );
}
