import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { DropTeaser } from "@/components/drop/drop-teaser";

export default async function DropPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("drop");

  return (
    <main className="mx-auto max-w-[1000px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("pageTitle")} jp="ドロップ" />
      <div className="mt-8">
        <DropTeaser />
      </div>
    </main>
  );
}
