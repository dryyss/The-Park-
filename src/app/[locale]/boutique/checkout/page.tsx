import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getViewerCart } from "@/server/cart/cart.service";
import { PageHeader } from "@/components/common/page-header";
import { ShopOfficialBanner } from "@/components/shop/shop-sections";
import { CheckoutForm } from "@/components/cart/checkout-form";

export const dynamic = "force-dynamic";

export default async function BoutiqueCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { locale } = await params;
  const { cancelled } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");

  const authenticated = await requireAuthViewer(`/${locale}/boutique/checkout`);
  const cart = await getViewerCart(authenticated.id);

  return (
    <main className="mx-auto max-w-[1000px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="決済" />
      {cancelled === "1" && (
        <p className="mt-4 rounded-[12px] border border-neon-orange/30 bg-neon-orange/10 px-4 py-3 text-center text-[13px] font-bold text-neon-orange">
          {t("cancelled")}
        </p>
      )}
      <div className="mt-6">
        <ShopOfficialBanner />
      </div>
      <div className="mt-8">
        <CheckoutForm
          cart={cart}
          locale={locale}
          isAuthenticated
          defaultName={authenticated.displayName}
        />
      </div>
    </main>
  );
}
