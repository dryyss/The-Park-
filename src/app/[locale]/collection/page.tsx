import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getUserCollection } from "@/server/collection/collection.service";
import { getViewerWishlistCardIds } from "@/server/wishlist/wishlist.service";
import { getCardsLikeMeta } from "@/server/card-like/card-like.service";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/common/page-header";
import { CompletionPanel, CollectionFiltersBar } from "@/components/collection/collection-filters";
import { CollectionCardGrid } from "@/components/collection/collection-card-grid";
import { CollectionDisplayControls } from "@/components/collection/collection-display-controls";
import { CollectionExportShare } from "@/components/collection/collection-export-share";
import { CollectionGuestBanner } from "@/components/collection/collection-guest-banner";
import { parseCollectionGridCols, parseCollectionSort } from "@/lib/collection-grid";
import { SeasonTabs } from "@/components/collection/season-tabs";
import { HORS_SERIE_SEASON_CODE } from "@/lib/seasons";
import { localePageMetadata } from "@/lib/seo-messages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localePageMetadata("collection", locale, "/collection");
}

type SP = { segment?: string; rarity?: string; q?: string; cols?: string; sort?: string; season?: string; edition?: string };

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("collection");

  const viewer = await getViewerUser();
  const isAuthenticated = !!viewer;

  const activeSeason = sp.season ?? null;
  const activeEdition = (sp.edition === "first" || sp.edition === "reprint" ? sp.edition : null) as "first" | "reprint" | null;

  const collParams = {
    segment: (sp.segment === "owned" || sp.segment === "missing" ? sp.segment : "all") as "all" | "owned" | "missing",
    rarity: sp.rarity,
    q: sp.q,
    cols: parseCollectionGridCols(sp.cols),
    sort: parseCollectionSort(sp.sort),
    season: activeSeason ?? undefined,
    edition: activeEdition ?? undefined,
  };

  const [data, wishlistCardIds, seasons] = await Promise.all([
    getUserCollection(viewer?.id ?? null, collParams),
    viewer ? getViewerWishlistCardIds(viewer.id) : Promise.resolve([]),
    prisma.season.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const wishlistCardIdSet = new Set(wishlistCardIds);
  const allCardIds = data.sections.flatMap((sec) => sec.cards.map((c) => c.cardId));
  const likeMeta = Object.fromEntries(await getCardsLikeMeta(allCardIds, viewer?.id));

  return (
    <main className="page-section">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="駐車場">
        <SeasonTabs
          seasons={seasons}
          seasonPcts={data.seasonPcts}
          activeSeason={activeSeason}
          activeEdition={activeEdition}
          horsSerieCode={HORS_SERIE_SEASON_CODE}
          labels={{
            seasonHS: t("seasonHS"),
            editionBadge1st: t("editionBadge1st"),
            editionBadgeReprint: t("editionBadgeReprint"),
          }}
        />
      </PageHeader>

      {!isAuthenticated && <CollectionGuestBanner messageKey="loginGateCollection" />}

      <CompletionPanel
        data={data}
        activeEdition={activeEdition}
        seasonLabel={activeSeason ? (seasons.find((s) => s.code === activeSeason)?.name ?? null) : null}
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3.5">
        <CollectionFiltersBar params={collParams} counts={data.counts} locale={locale} />
        <div className="flex flex-wrap items-center gap-3.5">
          {isAuthenticated && <CollectionExportShare slug={viewer?.slug ?? null} />}
          <Suspense fallback={null}>
            <CollectionDisplayControls />
          </Suspense>
        </div>
      </div>

      {data.sections.map((sec) => (
        <section key={sec.code} className="mt-9">
          <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3.5">
            <span className="text-[20px]" style={{ color: sec.color }}>{sec.glyph}</span>
            <h2 className="font-display text-[24px] tracking-[2px] -skew-x-3 uppercase text-blanc-casse">{sec.title}</h2>
            <span className="font-jp text-[12px] font-bold tracking-[2px] text-texte-faible">{sec.jp}</span>
            <span
              className="rounded-full border border-charbon-500 bg-charbon-800 px-2.5 py-1 text-[12px] font-extrabold"
              style={{ color: sec.color }}
            >
              {sec.owned}/{sec.total}
            </span>
            <div className="flex-1" />
            <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
              <span className="text-[11px] font-bold tabular-nums text-texte-faible">{sec.pct}%</span>
              <div className="h-[5px] min-w-0 flex-1 overflow-hidden rounded bg-charbon-600 sm:w-[130px] sm:flex-none">
                <div className="h-full rounded transition-all" style={{ width: `${sec.pct}%`, background: sec.color }} />
              </div>
            </div>
          </div>
          <CollectionCardGrid
            cards={sec.cards}
            cols={collParams.cols}
            missingLabel={t("missing")}
            isAuthenticated={isAuthenticated}
            wishlistCardIds={wishlistCardIdSet}
            likeMeta={likeMeta}
          />
        </section>
      ))}
    </main>
  );
}
