import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getViewerUser } from "@/server/user/user.service";
import { getSaleTrackingForViewer } from "@/server/sale/sale.service";
import { SaleTrackingPanel, type SaleTrackingView } from "@/components/sale/sale-tracking-panel";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";
import { isHandDelivery } from "@/lib/shipping";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function SaleTrackingPage({
  params,
}: {
  params: Promise<{ locale: string; saleId: string }>;
}) {
  const { locale, saleId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("saleTracking");

  const viewer = await getViewerUser();
  if (!viewer) {
    return (
      <main className="page-section">
        <GuestAuthBanner messageKey="loginGateDashboard" />
      </main>
    );
  }

  const tracking = await getSaleTrackingForViewer(saleId, viewer.id);
  if (!tracking) notFound();
  const { sale, isBuyer } = tracking;

  const counterpart = isBuyer ? sale.seller : sale.buyer;
  const address = sale.deliveryAddress as SaleTrackingView["deliveryAddress"];
  const shippingCost = Number(sale.shippingCost);

  const view: SaleTrackingView = {
    saleId: sale.id,
    status: sale.status,
    shippingMode: sale.shippingMode,
    handDelivery: isHandDelivery(sale.shippingMode),
    priceLabel: formatPrice(Number(sale.price)),
    shippingCostLabel: shippingCost > 0 ? formatPrice(shippingCost) : null,
    totalLabel: formatPrice(Number(sale.price) + Number(sale.serviceFee) + shippingCost),
    isBuyer,
    card: {
      name: sale.listing.variant.card.name,
      image: cardImage(sale.listing.variant.imageUrl ?? sale.listing.variant.card.imageUrl),
      versionLabel: sale.listing.variant.versionType.label,
    },
    counterpart: { name: counterpart.displayName, slug: counterpart.slug },
    conversationId: sale.conversation?.id ?? null,
    deliveryAddress: address ?? null,
    shipment: sale.shipment
      ? {
          id: sale.shipment.id,
          status: sale.shipment.status,
          trackingNumber: sale.shipment.trackingNumber,
          carrier: sale.shipment.carrier,
          // Le jeton du jour n'est montré qu'à l'expéditeur (anti-fraude).
          dropToken: isBuyer ? null : sale.shipment.dropToken,
          notShipDeadline: sale.shipment.notShipDeadline?.toISOString() ?? null,
          guaranteeEndsAt: sale.shipment.guaranteeEndsAt?.toISOString() ?? null,
          proofs: sale.shipment.proofs.map((p) => ({ id: p.id, kind: p.kind, mediaUrl: p.mediaUrl })),
        }
      : null,
    disputeOpen: sale.disputes.some((d) => d.status !== "RESOLVED" && d.status !== "CLOSED"),
  };

  return (
    <main className="page-section">
      <Link
        href={isBuyer ? "/marketplace/achats" : "/dashboard/ventes"}
        className="text-[12px] font-extrabold text-carmin hover:underline"
      >
        ← {isBuyer ? t("backPurchases") : t("backSales")}
      </Link>
      <h1 className="font-display mt-4 text-[clamp(28px,4vw,44px)] leading-tight -skew-x-3 uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
        {t(isBuyer ? "titleBuyer" : "titleSeller")}
      </h1>
      <div className="mt-8">
        <SaleTrackingPanel view={view} />
      </div>
    </main>
  );
}
