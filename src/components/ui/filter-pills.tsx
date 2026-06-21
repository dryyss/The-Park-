"use client";

export interface FilterPillItem {
  key: string;
  label: string;
  count?: number;
}

export function FilterPills({
  items,
  activeKey,
  onChange,
}: {
  items: FilterPillItem[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((f) => {
        const active = f.key === activeKey;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={[
              "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition hover:-translate-y-0.5",
              active
                ? "border-carmin bg-carmin/12 text-blanc-casse"
                : "border-charbon-500 bg-charbon-800 text-texte-muet hover:border-charbon-400",
            ].join(" ")}
          >
            {f.label}
            {f.count !== undefined && <span className="opacity-60">{f.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
