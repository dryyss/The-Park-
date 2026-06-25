import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { FriendRequestsPanel } from "@/components/friend/friend-requests-panel";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function RivauxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("friends");

  const viewer = await getViewerUser();

  return (
    <main className="page-section">
      <div className="mb-8">
        <div className="mb-2 text-[12px] font-bold tracking-[4px] text-carmin uppercase">⚔ THE PARK</div>
        <h1 className="font-display text-[clamp(36px,5vw,60px)] leading-[0.95] -skew-x-6 uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
          {t("friendsTitle")}
        </h1>
      </div>

      {!viewer ? (
        <GuestAuthBanner messageKey="loginGateDashboard" />
      ) : (
        <FriendRequestsPanel viewerId={viewer.id} />
      )}
    </main>
  );
}
