import { Suspense, type ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { RankingsTabs } from "@/components/rankings/rankings-tabs";

/**
 * En-tête et onglets du classement, montés au niveau du segment : ils restent
 * affichés et cliquables pendant que la page se recharge, au lieu de disparaître
 * derrière le squelette plein écran de la locale.
 */
export default async function ClassementsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rankings");

  const tabs = [
    { k: "completion", label: t("catCompletion"), href: "/classements?cat=completion" },
    { k: "reputation", label: t("catReputation"), href: "/classements?cat=reputation" },
    { k: "sales", label: t("catSales"), href: "/classements?cat=sales" },
  ];

  return (
    <main className="mx-auto max-w-[1100px] page-pad pt-9 pb-[60px]">
      <PageHeader title={t("title")} jp="栄光">
        <Suspense fallback={null}>
          <RankingsTabs tabs={tabs} />
        </Suspense>
      </PageHeader>
      {children}
    </main>
  );
}
