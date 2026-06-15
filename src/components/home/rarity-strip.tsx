export interface RarityStripItem {
  glyph: string;
  label: string;
  count: number;
  color: string;
}

export function RarityStrip({ rarities }: { rarities: RarityStripItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {rarities.slice(0, 6).map((r) => (
        <div
          key={r.label}
          className="flex flex-col gap-1 rounded-2xl border border-charbon-500 bg-charbon-800 px-[18px] py-4 transition hover:border-charbon-400"
        >
          <div className="text-[20px]" style={{ color: r.color }}>{r.glyph}</div>
          <div className="text-[12.5px] font-extrabold tracking-[1px] text-blanc-casse uppercase">{r.label}</div>
          <div className="text-[11.5px] font-bold text-texte-dim">{r.count} cartes</div>
        </div>
      ))}
    </div>
  );
}
