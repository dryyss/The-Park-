import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { getReferralOverview } from "@/server/referral/referral.service";
import { PageHeader } from "@/components/common/page-header";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { ReferralPanel } from "@/components/referral/referral-panel";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function ParrainagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("referral");

  const viewer = await getAuthenticatedViewer();
  const overview = viewer ? await getReferralOverview(viewer.id) : null;

  return (
    <main className="mx-auto max-w-[720px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="紹介" />
      {!viewer && <GuestAuthBanner messageKey="loginGateWallet" />}
      <p className="mt-2 mb-6 text-[13px] leading-relaxed text-texte-muet">{t("intro")}</p>
      {overview && (
        <ReferralPanel
          overview={overview}
          prefillCode={sp.ref && sp.ref !== overview.code ? sp.ref.toUpperCase() : undefined}
        />
      )}
    </main>
  );
}
