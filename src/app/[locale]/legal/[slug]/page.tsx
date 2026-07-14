import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalDoc } from "@/components/legal/legal-doc";
import { LEGAL_SLUGS, isLegalSlug } from "@/data/legal-docs";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

type Params = { locale: string; slug: string };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return pageMetadata({
    title: t(`docs.${slug}.title`),
    description: t(`docs.${slug}.metaDescription`),
    path: `/${locale}/legal/${slug}`,
    locale,
  });
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  setRequestLocale(locale);
  return <LegalDoc slug={slug} />;
}
