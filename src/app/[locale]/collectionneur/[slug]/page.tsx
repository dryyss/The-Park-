import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button";
import { getCollectorProfile } from "@/server/community/community.service";
import { getViewerUser } from "@/server/user/user.service";
import { getFriendshipStatus } from "@/server/friend/friend.service";
import { avatarGradient } from "@/lib/avatars";
import { formatPercent } from "@/lib/format";
import { FriendButton } from "@/components/friend/friend-button";
import { ShowcaseBinder } from "@/components/showcase/showcase-binder";
import { getVisibleShowcases } from "@/server/showcase/showcase.service";
import { Link } from "@/i18n/navigation";
import { collectorPageMetadata } from "@/lib/seo";
import { getCollectorSeoData } from "@/server/seo/seo.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const collector = await getCollectorSeoData(slug);
  if (!collector) return {};
  return collectorPageMetadata(collector, locale);
}

export default async function CollectionneurPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collector");

  const [profile, viewer] = await Promise.all([getCollectorProfile(slug), getViewerUser()]);
  if (!profile) notFound();

  const isOwnProfile = viewer?.id === profile.userId;
  const friendshipStatus =
    viewer && !isOwnProfile ? await getFriendshipStatus(viewer.id, profile.userId) : null;

  const showcases = await getVisibleShowcases(profile.userId, viewer?.id ?? null);
  const hasShowcase = showcases.some((s) => s.items.length > 0);

  return (
    <main className="page-section">
      <div className="flex flex-wrap items-end gap-6 rounded-[20px] border border-charbon-500 bg-charbon-800 p-8">
        <div
          className="font-display flex h-20 w-20 -rotate-3 items-center justify-center rounded-[22px] text-[32px] text-white shadow-[4px_4px_0_rgba(0,0,0,0.45)]"
          style={{ background: avatarGradient(profile.initial) }}
        >
          {profile.initial}
        </div>
        <div className="flex-1">
          <h1 className="font-display text-[clamp(32px,5vw,48px)] leading-none -skew-x-3 uppercase text-blanc-casse">{profile.displayName}</h1>
          {profile.bio && <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-texte-doux">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-[13px] font-bold text-texte-dim">
            <span className="text-or">★ {profile.rating}</span>
            <span>{t("reviews", { count: profile.reviews })}</span>
            <span>
              {profile.owned}/{profile.total} · {formatPercent(profile.pct / 100)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {friendshipStatus !== null && (
            <FriendButton
              addresseeSlug={slug}
              initialStatus={friendshipStatus}
            />
          )}
          <ContactSellerButton
            sellerSlug={slug}
            locale={locale}
            className="font-display -skew-x-3 rounded-[10px] bg-carmin px-5 py-3 text-[13px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt"
          >
            {t("contact")}
          </ContactSellerButton>
        </div>
      </div>

      {(hasShowcase || isOwnProfile) && (
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[22px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">{t("collectionPreview")}</h2>
            {isOwnProfile && (
              <Link
                href={`/collectionneur/${slug}/showroom`}
                className="font-display -skew-x-3 rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:text-blanc-casse"
              >
                {t("editShowroom")}
              </Link>
            )}
          </div>
          {hasShowcase ? (
            <ShowcaseBinder showcases={showcases.filter((s) => s.items.length > 0)} />
          ) : (
            <p className="rounded-[16px] border border-dashed border-charbon-500 bg-charbon-800/50 p-8 text-center text-[14px] text-texte-doux">
              {isOwnProfile ? t("emptyOwn") : t("emptyPublic")}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
