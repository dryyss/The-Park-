import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/common/page-header";
import { requireAuthViewer } from "@/server/user/user.service";
import { confirmMarketplaceCheckoutAction } from "@/server/marketplace-cart/marketplace-cart-checkout.actions";
import {
  fulfillMarketplaceCheckout,
  getMarketplaceCheckoutForBuyer,
} from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketplaceConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; checkoutId: string }>;
  searchParams: Promise<{ success?: string; session_id?: string }>;
}) {
  const { locale, checkoutId } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("marketplaceCart");

  const viewer = await requireAuthViewer(`/${locale}/marketplace/panier/confirmation/${checkoutId}`);

  if (sp.success === "1" && sp.session_id) {
    await confirmMarketplaceCheckoutAction(sp.session_id);
  } else if (sp.success === "1" && !sp.session_id) {
    await fulfillMarketplaceCheckout(checkoutId, null);
  }

  const checkout = await getMarketplaceCheckoutForBuyer(checkoutId, viewer.id);
  if (!checkout) notFound();

  const buyerInvoice = checkout.invoices.find((i) => i.recipient === "BUYER");
  const isPaid = checkout.status === "PAID";

  return (
    <main className="mx-auto max-w-[720px] px-7 pt-9 pb-[60px]">
      <PageHeader
        kicker={t("confirmationKicker")}
        title={isPaid ? t("confirmationTitle") : t("confirmationPending")}
        jp="完了"
      />

      <div className="mt-8 rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <p className="text-[12px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("orderNumber")}</p>
        <p className="font-display mt-1 text-[22px] text-blanc-casse">{checkout.checkoutNumber}</p>

        {buyerInvoice && (
          <p className="mt-3 text-[13px] font-bold text-texte-doux">
            {t("invoiceNumber")} : <span className="text-or">{buyerInvoice.invoiceNumber}</span>
          </p>
        )}

        <p className="mt-4 text-[13px] font-bold text-texte-dim">
          {t("itemsPurchased", { count: checkout.lines.length })} · {formatPrice(checkout.total)}
        </p>

        {isPaid && (
          <p className="mt-3 text-[12.5px] font-semibold text-statut-succes">{t("confirmationPaidHint")}</p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/marketplace"
          className="font-display inline-flex items-center justify-center rounded-lg bg-carmin px-6 py-3 text-[12px] tracking-[1.5px] text-white uppercase hover:bg-carmin-alt"
        >
          {t("continueShopping")}
        </Link>
        <Link
          href="/marketplace/commandes"
          className="font-display inline-flex items-center justify-center rounded-lg border border-charbon-400 px-6 py-3 text-[12px] tracking-[1.5px] text-blanc-casse uppercase hover:border-carmin"
        >
          {t("viewHistory")}
        </Link>
      </div>
    </main>
  );
}
