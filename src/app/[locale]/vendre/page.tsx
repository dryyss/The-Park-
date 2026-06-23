import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getViewerUser } from "@/server/user/user.service";
import { getOwnedCardsForSale } from "@/server/marketplace/sell.service";
import { getSellerReadiness } from "@/server/marketplace/seller-readiness.service";
import { SellForm } from "@/components/sell/sell-form";
import { SellerReadiness } from "@/components/sell/seller-readiness";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function VendrePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sell");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;
  const readiness = viewer ? await getSellerReadiness(viewer.id) : null;
  const cards = viewer && readiness?.ready ? await getOwnedCardsForSale(viewer.id) : [];

  return (
    <main className="mx-auto max-w-[1120px] page-pad pt-7 pb-[60px]">
      <nav className="flex items-center gap-3 text-[12.5px] font-bold text-texte-dim">
        <Link href="/collection" className="hover:text-carmin">
          {t("breadcrumbCollection")}
        </Link>
        <span className="text-charbon-400">/</span>
        <span className="text-texte-doux">{t("breadcrumbSell")}</span>
      </nav>

      <h1 className="font-display mt-4 text-[clamp(34px,4.5vw,52px)] leading-[0.95] -skew-x-3 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
        {t("title")}
      </h1>
      <p className="mt-3.5 text-[13.5px] font-bold text-texte-doux">{t("subtitle")}</p>

      {!isAuthenticated && <GuestAuthBanner messageKey="loginGateSell" />}

      <div className="mt-6">
        {!isAuthenticated ? (
          <SellerReadiness
            readiness={{
              ready: false,
              birthDate: null,
              addressCount: 0,
              steps: [
                { key: "account", required: true, done: false },
                { key: "age", required: true, done: false },
                { key: "address", required: true, done: false },
                { key: "payout", required: false, done: false },
              ],
            }}
            isAuthenticated={false}
          />
        ) : readiness?.ready ? (
          <SellForm cards={cards} isAuthenticated />
        ) : readiness ? (
          <SellerReadiness readiness={readiness} isAuthenticated />
        ) : null}
      </div>
    </main>
  );
}
