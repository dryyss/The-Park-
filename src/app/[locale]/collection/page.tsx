import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getUserCollection } from "@/server/collection/collection.service";
import { getViewerWishlistCardIds } from "@/server/wishlist/wishlist.service";
import { getCardsLikeMeta } from "@/server/card-like/card-like.service";
import { PageHeader } from "@/components/common/page-header";
import { CompletionPanel, CollectionFiltersBar } from "@/components/collection/collection-filters";
import { CollectionCardGrid } from "@/components/collection/collection-card-grid";
import { CollectionDisplayControls } from "@/components/collection/collection-display-controls";
import { CollectionGuestBanner } from "@/components/collection/collection-guest-banner";
import { parseCollectionGridCols, parseCollectionSort } from "@/lib/collection-grid";
import { ScrollToTopButton } from "@/components/common/scroll-to-top-button";
import { localePageMetadata } from "@/lib/seo-messages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localePageMetadata("collection", locale, "/collection");
}

type SP = { segment?: string; rarity?: string; q?: string; cols?: string; sort?: string };

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

  const collParams = {
    segment: (sp.segment === "owned" || sp.segment === "missing" ? sp.segment : "all") as "all" | "owned" | "missing",
    rarity: sp.rarity,
    q: sp.q,
    cols: parseCollectionGridCols(sp.cols),
    sort: parseCollectionSort(sp.sort),
  };

  const [data, wishlistCardIds] = await Promise.all([
    getUserCollection(viewer?.id ?? null, collParams),
    viewer ? getViewerWishlistCardIds(viewer.id) : Promise.resolve([]),
  ]);
  const wishlistCardIdSet = new Set(wishlistCardIds);
  const allCardIds = data.sections.flatMap((sec) => sec.cards.map((c) => c.cardId));
  const likeMeta = Object.fromEntries(await getCardsLikeMeta(allCardIds, viewer?.id));

  return (
    <main className="page-section">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="駐車場">
        <div className="flex w-full flex-wrap items-start justify-end gap-3 pb-1.5 sm:w-auto">
          <div className="flex flex-col items-start">
            <span className="font-display -rotate-1 rounded-lg bg-blanc-casse px-4.5 py-2.5 text-[13px] tracking-[1.5px] text-charbon shadow-[3px_3px_0_var(--color-carmin)]">
              {t("seasonActive")}
            </span>
            <div className="ml-2 mt-0.5 flex gap-1">
              <span
                className="bg-carmin px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] text-white"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))" }}
              >
                {t("editionBadge1st")}
              </span>
              <span
                className="bg-charbon-600 px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] text-texte-faible"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))" }}
              >
                {t("editionBadgeReprint")}
              </span>
            </div>
          </div>
          <span className="font-display cursor-not-allowed rounded-lg border border-dashed border-charbon-400 px-4.5 py-2.5 text-[13px] tracking-[1.5px] text-texte-faible">
            {t("seasonSoon")}
          </span>
        </div>
      </PageHeader>

      {!isAuthenticated && <CollectionGuestBanner messageKey="loginGateCollection" />}

      <CompletionPanel data={data} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3.5">
        <CollectionFiltersBar params={collParams} counts={data.counts} locale={locale} />
        <Suspense fallback={null}>
          <CollectionDisplayControls />
        </Suspense>
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
      <ScrollToTopButton />
    </main>
  );
}
