import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { DropTeaser } from "@/components/drop/drop-teaser";
import { localePageMetadata } from "@/lib/seo-messages";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localePageMetadata("drop", locale, "/drop");
}

export default async function DropPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("drop");

  return (
    <main className="mx-auto max-w-[1000px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("pageTitle")} jp="ドロップ" />
      <div className="mt-8">
        <DropTeaser />
      </div>
    </main>
  );
}
