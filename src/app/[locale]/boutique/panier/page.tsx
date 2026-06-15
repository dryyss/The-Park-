import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getViewerCart } from "@/server/cart/cart.service";
import { PageHeader } from "@/components/common/page-header";
import { CartView } from "@/components/cart/cart-view";

export const dynamic = "force-dynamic";

export default async function BoutiquePanierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cart");

  const viewer = await requireAuthViewer(`/${locale}/boutique/panier`);
  const cart = await getViewerCart(viewer.id);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="カート" />
      <div className="mt-8">
        <CartView cart={cart} />
      </div>
    </main>
  );
}
