import { setRequestLocale, getTranslations } from "next-intl/server";
import { PagePlaceholder } from "@/components/common/page-placeholder";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  return <PagePlaceholder title={t("messages")} jp="メッセージ" />;
}
