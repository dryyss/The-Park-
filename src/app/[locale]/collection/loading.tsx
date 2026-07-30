/**
 * Squelette du Garage, borné au contenu.
 *
 * Il prend la place de la grille uniquement : l'en-tête et les onglets, rendus
 * par le layout du segment, restent visibles et cliquables. Sans cette borne,
 * c'est le `loading.tsx` de la locale qui s'appliquait et remplaçait la page
 * entière, onglets compris — un clic émis pendant ce temps était perdu.
 */
export default function CollectionLoading() {
  return (
    <div className="mt-6 animate-pulse" aria-busy="true" aria-label="Chargement du classeur">
      <div className="h-[92px] rounded-[16px] border border-charbon-500 bg-charbon-800" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-24 rounded-full border border-charbon-500 bg-charbon-800" />
          ))}
        </div>
        <div className="h-8 w-40 rounded-[10px] border border-charbon-500 bg-charbon-800" />
      </div>

      {[0, 1].map((section) => (
        <section key={section} className="mt-9">
          <div className="mb-4 flex items-center gap-3.5">
            <div className="h-6 w-44 rounded bg-charbon-700" />
            <div className="h-5 w-16 rounded-full bg-charbon-700" />
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="aspect-5/7 rounded-[10px] border border-charbon-500 bg-charbon-800" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
