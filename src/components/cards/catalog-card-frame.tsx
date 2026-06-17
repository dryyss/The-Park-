import type { CSSProperties, ReactNode } from "react";

/** Cadre catalogue : bordure néon au survol, teintée par la couleur de rareté. */
export function CatalogCardFrame({
  children,
  rarityColor,
  className,
}: {
  children: ReactNode;
  rarityColor: string;
  className?: string;
}) {
  return (
    <div
      className={`group ${className ?? ""}`}
      style={{ "--rarity-color": rarityColor } as CSSProperties}
    >
      <div className="overflow-hidden rounded-xl border-2 border-charbon-500/45 transition-[border-color,box-shadow] duration-200 group-hover:border-[var(--rarity-color)] group-hover:shadow-[0_0_18px_color-mix(in_srgb,var(--rarity-color)_55%,transparent)]">
        {children}
      </div>
    </div>
  );
}
