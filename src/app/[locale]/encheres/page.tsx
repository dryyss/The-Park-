import { setRequestLocale, getTranslations } from "next-intl/server";
import { getActiveAuctions } from "@/server/auction/auction.service";
import { PageHeader } from "@/components/common/page-header";
import { AuctionGrid } from "@/components/auction/auction-sections";

export const dynamic = "force-dynamic";

export default async function EncheresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auctions");

  const auctions = await getActiveAuctions();

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="オークション" />
      <p className="mt-3 max-w-2xl text-[13px] font-bold text-texte-dim">{t("subtitle")}</p>
      <div className="mt-8">
        <AuctionGrid auctions={auctions} />
      </div>
    </main>
  );
}
