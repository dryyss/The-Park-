import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { HelpFaq } from "@/components/help/help-faq";

export default async function AidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");

  return (
    <main className="mx-auto max-w-[800px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="ヘルプ" />
      <div className="mt-8">
        <HelpFaq />
      </div>
    </main>
  );
}
