import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";
import { getViewerProfile } from "@/server/profile/profile.service";
import {
  ProfileBadges,
  ProfileHeader,
  ProfileQuickLinks,
  ProfileReviews,
  ProfileSidebar,
} from "@/components/profile/profile-sections";
import { ProfileGuestOrRecovery } from "@/components/profile/profile-guest-or-recovery";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function ProfilPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  const viewer = await getAuthenticatedViewer();

  if (!viewer) {
    return (
      <ProfileGuestOrRecovery
        guestLinks={[
          { href: "/collection", label: t("guestLinkCollection") },
          { href: "/marketplace", label: t("guestLinkMarketplace") },
          { href: "/saison-1", label: t("guestLinkSeason") },
          { href: "/recherche", label: t("guestLinkSearch") },
        ]}
      />
    );
  }

  await evaluateUserBadgesSafe(viewer.id);
  const profile = await getViewerProfile(viewer.id);
  if (!profile) {
    return <main className="page-container py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  return (
    <main className="page-section pt-8">
      <ProfileHeader profile={profile} />
      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[330px_1fr]">
        <ProfileSidebar profile={profile} />
        <div className="flex flex-col gap-6">
          <ProfileQuickLinks profile={profile} />
          <ProfileBadges profile={profile} />
          <ProfileReviews profile={profile} />
        </div>
      </div>
    </main>
  );
}
