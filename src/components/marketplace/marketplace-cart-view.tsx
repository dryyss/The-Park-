import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { MarketplaceCartClient } from "@/components/marketplace/marketplace-cart-client";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerMarketplaceCart } from "@/server/marketplace-cart/marketplace-cart.service";

export async function MarketplaceCartView({ locale }: { locale: string }) {
  const t = await getTranslations("marketplaceCart");
  const viewer = await getViewerUser();
  const cart = viewer
    ? await getViewerMarketplaceCart(viewer.id)
    : { lines: [], itemCount: 0, subtotal: "0,00 €", subtotalRaw: 0 };

  return (
    <div>
      <p className="text-[11.5px] font-bold text-texte-faible">{t("disclaimer")}</p>
      {viewer ? (
        <MarketplaceCartClient cart={cart} locale={locale} />
      ) : (
        <div className="py-12">
          <GuestAuthBanner messageKey="loginGateBuy" />
        </div>
      )}
    </div>
  );
}
