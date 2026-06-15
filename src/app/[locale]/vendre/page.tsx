import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthViewer } from "@/server/user/user.service";
import { getOwnedCardsForSale } from "@/server/marketplace/sell.service";
import { SellForm } from "@/components/sell/sell-form";

export const dynamic = "force-dynamic";

export default async function VendrePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sell");

  const viewer = await requireAuthViewer(`/${locale}/vendre`);
  const cards = await getOwnedCardsForSale(viewer.id);

  return (
    <main className="mx-auto max-w-[1120px] px-7 pt-7 pb-[60px]">
      <nav className="flex items-center gap-3 text-[12.5px] font-bold text-texte-dim">
        <Link href="/collection" className="hover:text-carmin">
          {t("breadcrumbCollection")}
        </Link>
        <span className="text-charbon-400">/</span>
        <span className="text-texte-doux">{t("breadcrumbSell")}</span>
      </nav>

      <h1 className="font-display mt-4 text-[clamp(34px,4.5vw,52px)] leading-[0.95] -skew-x-3 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
        {t("title")}
      </h1>
      <p className="mt-3.5 text-[13.5px] font-bold text-texte-doux">{t("subtitle")}</p>

      <div className="mt-6">
        <SellForm cards={cards} />
      </div>
    </main>
  );
}
