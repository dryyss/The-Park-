import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getBuyerSales } from "@/server/sale/sale.service";
import { SaleList, type SaleListEntry } from "@/components/sale/sale-list";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { PageHeader } from "@/components/common/page-header";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function MesAchatsPage({ params }: { params: Promise<{ locale: string }> }) {
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

  const sales = await getBuyerSales(viewer.id);
  const entries: SaleListEntry[] = sales.map((s) => ({
    id: s.id,
    status: s.status,
    price: Number(s.price),
    shippingCost: Number(s.shippingCost),
    cardName: s.listing.variant.card.name,
    cardImage: s.listing.variant.imageUrl ?? s.listing.variant.card.imageUrl,
    versionLabel: s.listing.variant.versionType.label,
    counterpartName: s.seller.displayName,
    updatedAt: s.updatedAt,
    trackingNumber: s.shipment?.trackingNumber ?? null,
    // L'acheteur doit agir quand le colis arrive (réception / validation).
    actionRequired: s.status === "SHIPPED" || s.status === "DELIVERED_WINDOW" || s.status === "DELIVERED",
  }));

  return (
    <main className="page-section">
      <PageHeader kicker={t("purchasesKicker")} title={t("purchasesTitle")} jp="購入" />
      <div className="mt-8">
        <SaleList sales={entries} emptyText={t("purchasesEmpty")} />
      </div>
    </main>
  );
}
