import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { MarketplaceCartView } from "@/components/marketplace/marketplace-cart-view";

export const dynamic = "force-dynamic";

export default async function MarketplacePanierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplaceCart");

  return (
    <main className="mx-auto max-w-[900px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="カート" />
      <MarketplaceCartView locale={locale} />
    </main>
  );
}
