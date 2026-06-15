import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCollectorProfile } from "@/server/community/community.service";
import { getUserCollection } from "@/server/collection/collection.service";
import { avatarGradient } from "@/lib/avatars";
import { formatPercent } from "@/lib/format";
import { CollectionCardTile } from "@/components/collection/collection-card-tile";

export const dynamic = "force-dynamic";

export default async function CollectionneurPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collector");

  const profile = await getCollectorProfile(slug);
  if (!profile) notFound();

  const collection = await getUserCollection(profile.userId, { segment: "owned" });

  const previewCards = collection?.sections.flatMap((s) => s.cards).slice(0, 12) ?? [];

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
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
        <Link
          href="/marketplace"
          className="font-display -skew-x-3 rounded-[10px] bg-carmin px-5 py-3 text-[13px] tracking-[1.5px] text-white uppercase"
        >
          {t("contact")}
        </Link>
      </div>

      {previewCards.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display mb-4 text-[22px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">{t("collectionPreview")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {previewCards.map((c) => (
              <CollectionCardTile key={c.slug} card={c} missingLabel={t("missing")} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
