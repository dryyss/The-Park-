import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { SeasonLockedTeaser } from "@/components/season/season-locked";

export default async function Saison2Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("season2");

  return (
    <main className="mx-auto max-w-[1000px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="シーズン2" />
      <div className="mt-8">
        <SeasonLockedTeaser />
      </div>
    </main>
  );
}
