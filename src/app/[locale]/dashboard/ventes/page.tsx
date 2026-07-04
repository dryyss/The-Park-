import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getSellerSales } from "@/server/sale/sale.service";
import { SaleList, type SaleListEntry } from "@/components/sale/sale-list";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { PageHeader } from "@/components/common/page-header";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function MesVentesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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

  const sales = await getSellerSales(viewer.id);
  const entries: SaleListEntry[] = sales.map((s) => ({
    id: s.id,
    status: s.status,
    price: Number(s.price),
    shippingCost: Number(s.shippingCost),
    cardName: s.listing.variant.card.name,
    cardImage: s.listing.variant.imageUrl ?? s.listing.variant.card.imageUrl,
    versionLabel: s.listing.variant.versionType.label,
    counterpartName: s.buyer.displayName,
    updatedAt: s.updatedAt,
    trackingNumber: s.shipment?.trackingNumber ?? null,
    // Le vendeur doit agir tant que le colis n'est pas expédié.
    actionRequired: s.status === "PAID" || s.status === "AWAITING_SHIPMENT",
  }));

  return (
    <main className="page-section">
      <PageHeader kicker={t("salesKicker")} title={t("salesTitle")} jp="販売" />
      <div className="mt-8">
        <SaleList sales={entries} emptyText={t("salesEmpty")} />
      </div>
    </main>
  );
}
