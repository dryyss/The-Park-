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
import { CollectionGuestBanner } from "@/components/collection/collection-guest-banner";
import { parseCollectionGridCols, parseCollectionSort } from "@/lib/collection-grid";
import { Link } from "@/i18n/navigation";
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
        <div className="flex w-full flex-wrap items-center justify-end gap-2 pb-1.5 sm:w-auto">
          {seasons.map((s) => {
            const isHS = s.code === HORS_SERIE_SEASON_CODE;
            const isActive = activeSeason === s.code;
            const href = isActive ? "/collection" : `/collection?season=${s.code}`;
            const sp = data.seasonPcts.find((p) => p.code === s.code);
            return (
              <Link
                key={s.id}
                href={href}
                className={[
                  "font-display flex flex-col items-center rounded-lg px-4.5 py-2 text-[13px] tracking-[1.5px] transition",
                  isActive
                    ? "bg-blanc-casse text-charbon shadow-[3px_3px_0_var(--color-carmin)]"
                    : isHS
                      ? "border border-dashed border-carmin/50 text-carmin hover:bg-carmin/10"
                      : "border border-dashed border-charbon-400 text-texte-faible hover:border-charbon-300 hover:text-blanc-casse",
                ].join(" ")}
              >
                <span>{isHS ? t("seasonHS") : s.name}</span>
                {sp && (
                  <span className={`mt-0.5 text-[9px] font-extrabold tracking-wide tabular-nums ${isActive ? "text-charbon/60" : "text-texte-faible"}`}>
                    {sp.pct}%
                  </span>
                )}
              </Link>
            );
          })}
          {activeSeason && (
            <div className="ml-2 mt-0.5 flex gap-1">
              <Link
                href={
                  activeEdition === "first"
                    ? `/collection?season=${activeSeason}`
                    : `/collection?season=${activeSeason}&edition=first`
                }
                className="px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] transition"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))",
                  background: activeEdition === "first" || activeEdition === null ? "var(--color-carmin)" : "#3a3a3a",
                  color: activeEdition === "first" || activeEdition === null ? "#fff" : "var(--color-texte-faible)",
                }}
              >
                {t("editionBadge1st")}
              </Link>
              <Link
                href={
                  activeEdition === "reprint"
                    ? `/collection?season=${activeSeason}`
                    : `/collection?season=${activeSeason}&edition=reprint`
                }
                className="px-2.5 pt-1 pb-2.5 text-[9px] font-extrabold tracking-[1.5px] transition"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 5px), 50% 100%, 0 calc(100% - 5px))",
                  background: activeEdition === "reprint" ? "var(--color-carmin)" : "#3a3a3a",
                  color: activeEdition === "reprint" ? "#fff" : "var(--color-texte-faible)",
                }}
              >
                {t("editionBadgeReprint")}
              </Link>
            </div>
          )}
        </div>
      </PageHeader>

      {!isAuthenticated && <CollectionGuestBanner messageKey="loginGateCollection" />}

      <CompletionPanel
        data={data}
        activeEdition={activeEdition}
        seasonLabel={activeSeason ? (seasons.find((s) => s.code === activeSeason)?.name ?? null) : null}
      />
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
    </main>
  );
}
