import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getAuctionById } from "@/server/auction/auction.service";
import { getViewerUser } from "@/server/user/user.service";
import { PageHeader } from "@/components/common/page-header";
import { AuctionDetailPanel } from "@/components/auction/auction-sections";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function EnchereDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auctions");

  const [auction, viewer] = await Promise.all([getAuctionById(id), getViewerUser()]);
  if (!auction) notFound();

  return (
    <main className="page-section">
      <Link href="/encheres" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader title={auction.cardName} jp="入札" />
      </div>
      <div className="mt-8">
        <AuctionDetailPanel auction={auction} viewerId={viewer?.id ?? null} />
      </div>
    </main>
  );
}
