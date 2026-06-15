import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getUserCollection } from "@/server/collection/collection.service";
import { PageHeader } from "@/components/common/page-header";
import { CompletionPanel, CollectionFiltersBar } from "@/components/collection/collection-filters";
import { CollectionCardTile } from "@/components/collection/collection-card-tile";

export const dynamic = "force-dynamic";

type SP = { segment?: string; rarity?: string; q?: string };

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
  if (!viewer) {
    return (
      <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>
    );
  }

  const collParams = {
    segment: (sp.segment === "owned" || sp.segment === "missing" ? sp.segment : "all") as "all" | "owned" | "missing",
    rarity: sp.rarity,
    q: sp.q,
  };

  const data = await getUserCollection(viewer.id, collParams);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="駐車場">
        <div className="flex gap-2 pb-1.5">
          <span className="font-display -rotate-1 rounded-lg bg-blanc-casse px-4.5 py-2.5 text-[13px] tracking-[1.5px] text-charbon shadow-[3px_3px_0_var(--color-carmin)]">
            {t("seasonActive")}
          </span>
          <span className="font-display cursor-not-allowed rounded-lg border border-dashed border-charbon-400 px-4.5 py-2.5 text-[13px] tracking-[1.5px] text-texte-faible">
            {t("seasonSoon")}
          </span>
        </div>
      </PageHeader>

      <CompletionPanel data={data} />
      <CollectionFiltersBar params={collParams} counts={data.counts} locale={locale} />

      {data.sections.map((sec) => (
        <section key={sec.code} className="mt-9">
          <div className="mb-4 flex items-center gap-3.5">
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
            <div className="h-[5px] w-[130px] overflow-hidden rounded bg-charbon-600">
              <div className="h-full rounded transition-all" style={{ width: `${sec.pct}%`, background: sec.color }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {sec.cards.map((card) => (
              <CollectionCardTile key={card.slug} card={card} missingLabel={t("missing")} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
