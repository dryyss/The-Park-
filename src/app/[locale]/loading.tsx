/** Skeleton affiché instantanément pendant la navigation (RSC en cours). */
export default function LocaleLoading() {
  return (
    <div className="mx-auto max-w-[1320px] animate-pulse px-7 pt-9 pb-[60px]" aria-busy="true" aria-label="Chargement">
      <div className="mb-6 h-4 w-48 rounded bg-charbon-700" />
      <div className="mb-3 h-14 w-2/3 max-w-lg rounded-lg bg-charbon-700" />
      <div className="mb-10 h-4 w-96 max-w-full rounded bg-charbon-800" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-charbon-600 bg-charbon-800">
            <div className="aspect-[5/7] bg-charbon-700" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 rounded bg-charbon-600" />
              <div className="h-3 w-1/2 rounded bg-charbon-600" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
