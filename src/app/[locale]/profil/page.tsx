import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerProfile } from "@/server/profile/profile.service";
import {
  ProfileBadges,
  ProfileHeader,
  ProfileQuickLinks,
  ProfileReviews,
  ProfileSidebar,
} from "@/components/profile/profile-sections";

export const dynamic = "force-dynamic";

export default async function ProfilPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getViewerUser();
  if (!viewer) {
    const t = await getTranslations("profile");
    return <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  const profile = await getViewerProfile(viewer.id);
  if (!profile) {
    const t = await getTranslations("profile");
    return <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-8 pb-[60px]">
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
