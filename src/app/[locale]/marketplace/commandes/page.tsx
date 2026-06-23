import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/common/page-header";
import { requireAuthViewer } from "@/server/user/user.service";
import { getBuyerMarketplaceCheckoutHistory } from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketplaceCommandesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplaceCart");

  const viewer = await requireAuthViewer(`/${locale}/marketplace/commandes`);
  const history = await getBuyerMarketplaceCheckoutHistory(viewer.id);

  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("historyKicker")} title={t("historyTitle")} jp="履歴" />

      {history.length === 0 ? (
        <p className="mt-10 text-center text-[14px] font-bold text-texte-dim">{t("historyEmpty")}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {history.map((order) => (
            <Link
              key={order.id}
              href={`/marketplace/panier/confirmation/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-charbon-500 bg-charbon-800 px-4 py-4 transition hover:border-carmin"
            >
              <div>
                <p className="font-display text-[15px] text-blanc-casse">{order.checkoutNumber}</p>
                <p className="text-[11px] font-bold text-texte-dim">
                  {order.paidAt?.toLocaleDateString(locale === "ja" ? "ja-JP" : locale === "en" ? "en-GB" : "fr-FR")}
                  {" · "}
                  {t("itemsPurchased", { count: order.lines.length })}
                </p>
              </div>
              <span className="font-display text-[18px] text-carmin">{formatPrice(order.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
