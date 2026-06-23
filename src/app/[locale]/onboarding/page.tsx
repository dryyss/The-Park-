import { setRequestLocale } from "next-intl/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OnboardingWizard />;
}
