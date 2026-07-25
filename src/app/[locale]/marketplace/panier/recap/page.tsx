import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { MarketplaceRecapClient } from "@/components/marketplace/marketplace-recap-client";
import { requireAuthViewer } from "@/server/user/user.service";
import { getMarketplaceRecap, cancelMarketplaceCheckoutById } from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { getViewerMarketplaceCart } from "@/server/marketplace-cart/marketplace-cart.service";
import { getWalletSpendableBalanceEur } from "@/server/wallet/wallet.service";
import { getUserAddresses } from "@/server/user/address.service";

export const dynamic = "force-dynamic";

function parseIdList(raw?: string): string[] | undefined {
  if (!raw || raw === "all") return undefined;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/**
 * Résout la sélection du panier. Sur un gros lot, énumérer les lignes retenues
 * produisait une URL de plusieurs dizaines de kilo-octets (une ligne = un cuid) :
 * le panier envoie donc `exclude` quand il y a moins d'exclusions que de retenues.
 */
async function resolveCartItemIds(
  userId: string,
  sp: { items?: string; exclude?: string },
): Promise<string[] | undefined> {
  const excluded = parseIdList(sp.exclude);
  if (excluded) {
    const cart = await getViewerMarketplaceCart(userId);
    const excludedSet = new Set(excluded);
    return cart.lines.filter((line) => !excludedSet.has(line.id)).map((line) => line.id);
  }
  return parseIdList(sp.items);
}

export default async function MarketplaceRecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ items?: string; exclude?: string; cancelled?: string; checkoutId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("marketplaceCart");

  const viewer = await requireAuthViewer(`/${locale}/marketplace/panier/recap`);

  if (sp.cancelled === "1" && sp.checkoutId) {
    await cancelMarketplaceCheckoutById(sp.checkoutId, viewer.id);
  }

  const cartItemIds = await resolveCartItemIds(viewer.id, sp);
  const [recap, walletBalance, addresses] = await Promise.all([
    getMarketplaceRecap(viewer.id, cartItemIds),
    getWalletSpendableBalanceEur(viewer.id),
    getUserAddresses(viewer.id),
  ]);

  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("recapKicker")} title={t("recapTitle")} jp="確認" />

      {sp.cancelled === "1" && (
        <p className="mt-4 rounded-lg border border-charbon-500 bg-charbon-800 px-4 py-3 text-[13px] font-bold text-texte-dim">
          {t("paymentCancelled")}
        </p>
      )}

      <MarketplaceRecapClient recap={recap} locale={locale} cartItemIds={cartItemIds} walletBalance={walletBalance} addresses={addresses} />
    </main>
  );
}
