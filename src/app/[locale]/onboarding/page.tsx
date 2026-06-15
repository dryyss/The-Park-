import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("onboarding");

  return (
    <main className="mx-auto max-w-[800px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="入門" />
      <p className="mt-3 text-[14px] font-semibold text-texte-dim">{t("intro")}</p>
      <div className="mt-8">
        <OnboardingSteps />
      </div>
    </main>
  );
}
