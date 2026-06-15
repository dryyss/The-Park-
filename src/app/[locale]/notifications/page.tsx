import { setRequestLocale, getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/common/page-placeholder";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  return <PagePlaceholder title={t("notifications")} jp="通知" />;
}
