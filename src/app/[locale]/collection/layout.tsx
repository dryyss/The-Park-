import { Suspense, type ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/common/page-header";
import { SeasonTabs } from "@/components/collection/season-tabs";
import { getViewerUser } from "@/server/user/user.service";
import { getSeasonCompletion, getSetCompletion } from "@/server/collection/collection.service";
import { HORS_SERIE_SEASON_CODE } from "@/lib/seasons";

/**
 * En-tête et onglets du Garage, montés au niveau du segment.
 *
 * Un layout n'est pas re-rendu quand seuls les paramètres d'URL changent : la
 * barre d'onglets reste donc affichée ET cliquable pendant que la page se
 * recharge. Auparavant, le `loading.tsx` de la locale remplaçait toute la page,
 * onglets compris : le temps du chargement il n'y avait plus rien à cliquer,
 * ce qui donnait l'impression que le clic n'était pas pris en compte.
 */
export default async function CollectionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("collection");

  const viewer = await getViewerUser();
  const [seasons, seasonPcts, setPcts] = await Promise.all([
    prisma.season.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } }),
    getSeasonCompletion(viewer?.id ?? null),
    getSetCompletion(viewer?.id ?? null),
  ]);

  return (
    <main className="page-section">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="駐車場">
        <Suspense fallback={null}>
          <SeasonTabs
            seasons={seasons}
            seasonPcts={seasonPcts}
            sets={setPcts.map((s) => ({ code: s.code, name: s.name, pct: s.pct }))}
            horsSerieCode={HORS_SERIE_SEASON_CODE}
            labels={{ seasonHS: t("seasonHS") }}
          />
        </Suspense>
      </PageHeader>
      {children}
    </main>
  );
}
