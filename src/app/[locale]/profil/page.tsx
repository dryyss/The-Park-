import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerProfile } from "@/server/profile/profile.service";
import {
  ProfileBadges,
  ProfileHeader,
  ProfileQuickLinks,
  ProfileReviews,
  ProfileSidebar,
} from "@/components/profile/profile-sections";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";

export const dynamic = "force-dynamic";

export default async function ProfilPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  const viewer = await getViewerUser();
  if (!viewer) {
    return (
      <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
        <div className="font-display text-[clamp(32px,4vw,48px)] leading-tight -skew-x-3 uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
          {t("guestTitle")}
        </div>
        <p className="mt-3 max-w-[560px] text-[14px] font-semibold text-texte-dim">{t("guestDesc")}</p>
        <GuestAuthBanner messageKey="loginGateProfile" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/collection", label: t("guestLinkCollection") },
            { href: "/marketplace", label: t("guestLinkMarketplace") },
            { href: "/saison-1", label: t("guestLinkSeason") },
            { href: "/recherche", label: t("guestLinkSearch") },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl border border-charbon-500 bg-charbon-800 p-4 text-center transition hover:border-carmin"
            >
              <span className="text-[13px] font-extrabold text-blanc-casse">{l.label}</span>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  const profile = await getViewerProfile(viewer.id);
  if (!profile) {
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
