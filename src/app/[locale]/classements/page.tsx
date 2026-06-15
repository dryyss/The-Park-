import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getViewerUser } from "@/server/user/user.service";
import { getRankings, type RankingCategory } from "@/server/community/community.service";
import { PageHeader } from "@/components/common/page-header";
import { RankingsPodium, RankingsTable } from "@/components/rankings/rankings-podium";

export const dynamic = "force-dynamic";

function catHref(cat: RankingCategory): string {
  return `/classements?cat=${cat}`;
}

export default async function ClassementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("rankings");

  const cat: RankingCategory =
    sp.cat === "reputation" || sp.cat === "exchanges" ? sp.cat : "completion";

  const viewer = await getViewerUser();
  const data = await getRankings(cat, viewer?.slug);

  const tabs: { k: RankingCategory; label: string }[] = [
    { k: "completion", label: t("catCompletion") },
    { k: "reputation", label: t("catReputation") },
    { k: "exchanges", label: t("catExchanges") },
  ];

  return (
    <main className="mx-auto max-w-[1100px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="栄光">
        <div className="mb-1 flex gap-1 rounded-xl border border-charbon-500 bg-charbon-800 p-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.k}
              href={catHref(tab.k)}
              className={[
                "font-display rounded-lg px-4 py-2.5 text-[12.5px] tracking-[1.5px] uppercase transition",
                cat === tab.k ? "bg-carmin text-white" : "text-texte-muet hover:text-blanc-casse",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </PageHeader>

      <RankingsPodium rows={data.podium} />
      <RankingsTable rows={data.rows} />
    </main>
  );
}
