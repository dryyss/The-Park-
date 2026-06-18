import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireAuthViewer } from "@/server/user/user.service";
import { getSaleForBuyer } from "@/server/sale/sale.service";
import { confirmSaleCheckoutAction } from "@/server/sale/sale.actions";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketplaceAchatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; saleId: string }>;
  searchParams: Promise<{ success?: string; session_id?: string }>;
}) {
  const { locale, saleId } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("saleCheckout");

  const viewer = await requireAuthViewer(`/${locale}/marketplace/achat/${saleId}`);

  if (sp.success === "1" && sp.session_id) {
    await confirmSaleCheckoutAction(sp.session_id);
  }

  const sale = await getSaleForBuyer(saleId, viewer.id);
  if (!sale) notFound();

  const card = sale.listing.variant.card;
  const isPaid = sale.status !== "PENDING_PAYMENT" && sale.status !== "CANCELLED";
  const conversationId = sale.conversation?.id;

  if (isPaid && conversationId && sp.success === "1") {
    redirect(`/${locale}/messages/${conversationId}?purchased=1`);
  }

  return (
    <main className="mx-auto max-w-[640px] px-7 pt-9 pb-[60px]">
      <nav className="flex items-center gap-3 text-[12.5px] font-bold text-texte-dim">
        <Link href="/marketplace" className="hover:text-carmin">
          {t("breadcrumbMarket")}
        </Link>
        <span className="text-charbon-400">/</span>
        <span className="text-texte-doux">{t("breadcrumbCheckout")}</span>
      </nav>

      <h1 className="font-display mt-4 text-[clamp(28px,4vw,40px)] leading-tight -skew-x-3 uppercase text-blanc-casse">
        {isPaid ? t("titleSuccess") : t("titlePending")}
      </h1>

      <div className="mt-6 rounded-[18px] border border-charbon-500 bg-charbon-800 p-5">
        <div className="text-[14px] font-extrabold text-blanc-casse">{card.name}</div>
        <div className="mt-1 text-[12px] font-bold text-texte-dim">
          #{String(card.number).padStart(2, "0")} · {sale.listing.variant.versionType.label}
        </div>
        <div className="font-display mt-4 text-[24px] text-blanc-casse">{formatPrice(sale.price)}</div>
        <p className="mt-3 text-[12.5px] font-semibold text-texte-dim">{t("sellerNotified")}</p>
      </div>

      {conversationId && (
        <Link
          href={`/messages/${conversationId}`}
          className="font-display mt-6 inline-block -skew-x-3 rounded-lg bg-carmin px-6 py-3 text-[12.5px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt"
        >
          {t("goMessages")} →
        </Link>
      )}

      <Link href="/marketplace" className="mt-4 block text-[12px] font-bold text-texte-faible hover:text-carmin">
        ← {t("backMarket")}
      </Link>
    </main>
  );
}
