import { getCatalogSummary } from "@/server/catalog/catalog.service";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { season, totalCards, byRarity } = await getCatalogSummary();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="font-display text-carmin text-sm tracking-[0.3em] uppercase">
          Trading Card Game · Drift / JDM 駐車場
        </p>
        <h1 className="font-display text-6xl leading-none font-bold uppercase">The Park</h1>
        <p className="text-blanc-casse/70 max-w-prose">
          Plateforme de collection, d&apos;échange et de marketplace communautaire. Fondations en
          place — la suite : comptes, catalogue, collection multi-versions.
        </p>
      </header>

      <section className="border-charbon-500 bg-charbon-700/40 rounded-lg border p-6">
        <h2 className="font-display text-xl uppercase">
          {season ? `Saison ${season.code} — ${season.name}` : "Aucune saison en base"}
        </h2>
        <p className="text-blanc-casse/60 mt-1 text-sm">
          {totalCards} cartes en base ·{" "}
          <span className="text-statut-succes">stack Next 15 → Prisma 7 → Neon opérationnelle</span>
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
        <Button>Commencer</Button>
        <Button variant="outline">Découvrir le catalogue</Button>
      </div>
    </main>
  );
}
