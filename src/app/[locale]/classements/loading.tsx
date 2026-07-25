/**
 * Squelette du classement, borné au contenu : les onglets rendus par le layout
 * du segment restent visibles et cliquables pendant le chargement.
 */
export default function ClassementsLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Chargement du classement">
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[168px] rounded-[18px] border border-charbon-500 bg-charbon-800" />
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-14 rounded-[14px] border border-charbon-500 bg-charbon-800" />
        ))}
      </div>
    </div>
  );
}
