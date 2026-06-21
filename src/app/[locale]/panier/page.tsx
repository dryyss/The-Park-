import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { UnifiedCartView } from "@/components/cart/unified-cart-view";

export const dynamic = "force-dynamic";

export default async function PanierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("unifiedCart");

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="カート" />
      <div className="mt-8">
        <UnifiedCartView locale={locale} />
      </div>
    </main>
  );
}
