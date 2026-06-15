import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getViewerOrders } from "@/server/order/order.service";
import { PageHeader } from "@/components/common/page-header";
import { ShopOfficialBanner } from "@/components/shop/shop-sections";
import { OrderList } from "@/components/order/order-sections";

export const dynamic = "force-dynamic";

export default async function BoutiqueCommandesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("orders");

  const viewer = await requireAuthViewer(`/${locale}/boutique/commandes`);
  const orders = await getViewerOrders(viewer.id);

  return (
    <main className="mx-auto max-w-[900px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="注文" />
      <div className="mt-6">
        <ShopOfficialBanner />
      </div>
      <div className="mt-8">
        <OrderList orders={orders} />
      </div>
    </main>
  );
}
