import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCatalogSummary } from "@/server/catalog/catalog.service";
import { Button } from "@/components/ui/button";
import { AuthStatus } from "@/components/auth/auth-status";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const { season, totalCards, byRarity } = await getCatalogSummary();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 px-6 py-16">
      <div className="flex justify-end">
        <AuthStatus />
      </div>

      <header className="space-y-3">
        <p className="font-display text-carmin text-sm tracking-[0.3em] uppercase">
          {t("tagline")}
        </p>
        <h1 className="font-display text-6xl leading-none font-bold uppercase">The Park</h1>
        <p className="text-blanc-casse/70 max-w-prose">{t("intro")}</p>
      </header>

      <section className="border-charbon-500 bg-charbon-700/40 rounded-lg border p-6">
        <h2 className="font-display text-xl uppercase">
          {season ? t("seasonTitle", { code: season.code, name: season.name }) : t("noSeason")}
        </h2>
        <p className="text-blanc-casse/60 mt-1 text-sm">
          {t("cardsInBase", { count: totalCards })} ·{" "}
          <span className="text-statut-succes">{t("stackOk")}</span>
        </p>

        {byRarity.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {byRarity.map((r) => (
              <li
                key={r.code}
                className="border-charbon-500 rounded-md border px-3 py-1 text-sm"
                style={r.color ? { color: r.color } : undefined}
              >
                <span className="mr-1">{r.symbol}</span>
                {r.label} · {r.count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
        <Button>{tc("start")}</Button>
        <Button variant="outline">{tc("browseCatalog")}</Button>
      </div>
    </main>
  );
}
