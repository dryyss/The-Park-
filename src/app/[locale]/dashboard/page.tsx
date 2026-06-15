import { setRequestLocale, getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/common/page-placeholder";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("footer");
  return <PagePlaceholder title={t("linkSellerDashboard")} jp="ダッシュボード" />;
}
