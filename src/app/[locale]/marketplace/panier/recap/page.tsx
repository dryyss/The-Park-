import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { MarketplaceRecapClient } from "@/components/marketplace/marketplace-recap-client";
import { requireAuthViewer } from "@/server/user/user.service";
import { getMarketplaceRecap } from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { cancelMarketplaceCheckoutById } from "@/server/marketplace-cart/marketplace-cart-checkout.service";

export const dynamic = "force-dynamic";

function parseCartItemIds(raw?: string): string[] | undefined {
  if (!raw || raw === "all") return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function MarketplaceRecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ items?: string; cancelled?: string; checkoutId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("marketplaceCart");

  const viewer = await requireAuthViewer(`/${locale}/marketplace/panier/recap`);

  if (sp.cancelled === "1" && sp.checkoutId) {
    await cancelMarketplaceCheckoutById(sp.checkoutId, viewer.id);
  }

  const cartItemIds = parseCartItemIds(sp.items);
  const recap = await getMarketplaceRecap(viewer.id, cartItemIds);

  return (
    <main className="mx-auto max-w-[900px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("recapKicker")} title={t("recapTitle")} jp="確認" />

      {sp.cancelled === "1" && (
        <p className="mt-4 rounded-lg border border-charbon-500 bg-charbon-800 px-4 py-3 text-[13px] font-bold text-texte-dim">
          {t("paymentCancelled")}
        </p>
      )}

      <MarketplaceRecapClient recap={recap} locale={locale} cartItemIds={cartItemIds} />
    </main>
  );
}
