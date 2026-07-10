import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getViewerUser } from "@/server/user/user.service";
import { getRankings, type RankingCategory } from "@/server/community/community.service";
import { PageHeader } from "@/components/common/page-header";
import { RankingsPodium, RankingsTable } from "@/components/rankings/rankings-podium";
import { RankingsTabs } from "@/components/rankings/rankings-tabs";
import { localePageMetadata } from "@/lib/seo-messages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localePageMetadata("classements", locale, "/classements");
}

function rankingsHref(cat: RankingCategory, page?: number): string {
  const params = new URLSearchParams({ cat });
  if (page && page > 1) params.set("page", String(page));
  return `/classements?${params.toString()}`;
}

export default async function ClassementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cat?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("rankings");

  const cat: RankingCategory =
    sp.cat === "reputation" || sp.cat === "sales" ? sp.cat : "completion";
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const viewer = await getViewerUser();
  const data = await getRankings(cat, viewer?.slug, requestedPage);

  const tabs = [
    { k: "completion", label: t("catCompletion"), href: rankingsHref("completion") },
    { k: "reputation", label: t("catReputation"), href: rankingsHref("reputation") },
    { k: "sales", label: t("catSales"), href: rankingsHref("sales") },
  ];

  const onFirstPage = data.page === 1;
  const hasPrev = data.page > 1;
  const hasNext = data.page < data.pageCount;

  return (
    <main className="mx-auto max-w-[1100px] page-pad pt-9 pb-[60px]">
      <PageHeader title={t("title")} jp="栄光">
        <RankingsTabs tabs={tabs} current={cat} />
      </PageHeader>

      {onFirstPage && <RankingsPodium rows={data.podium} />}

      {data.viewerRank !== null && (
        <p className="mt-5 text-[12.5px] font-bold text-texte-muet">
          {t("yourRank", { rank: data.viewerRank, total: data.total })}
        </p>
      )}

      {data.rows.length > 0 ? (
        <RankingsTable rows={data.rows} />
      ) : (
        <p className="mt-8 rounded-[18px] border border-charbon-500 bg-charbon-800 px-6 py-10 text-center text-[13px] text-texte-muet">
          {t("empty")}
        </p>
      )}

      {data.pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label={t("pagination")}>
          {hasPrev ? (
            <Link
              href={rankingsHref(cat, data.page - 1)}
              className="font-display rounded-[10px] border-[1.5px] border-charbon-400 px-5 py-2.5 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin hover:text-white"
            >
              ← {t("prev")}
            </Link>
          ) : (
            <span className="font-display rounded-[10px] border-[1.5px] border-charbon-600 px-5 py-2.5 text-[12px] tracking-[1.5px] text-texte-dim uppercase opacity-40">
              ← {t("prev")}
            </span>
          )}

          <span className="font-display text-[12px] tracking-[1px] text-texte-muet uppercase">
            {t("pageOf", { page: data.page, total: data.pageCount })}
          </span>

          {hasNext ? (
            <Link
              href={rankingsHref(cat, data.page + 1)}
              className="font-display rounded-[10px] border-[1.5px] border-charbon-400 px-5 py-2.5 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin hover:text-white"
            >
              {t("next")} →
            </Link>
          ) : (
            <span className="font-display rounded-[10px] border-[1.5px] border-charbon-600 px-5 py-2.5 text-[12px] tracking-[1.5px] text-texte-dim uppercase opacity-40">
              {t("next")} →
            </span>
          )}
        </nav>
      )}
    </main>
  );
}
