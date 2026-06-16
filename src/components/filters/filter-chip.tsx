import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { buildHref } from "@/lib/query";

// Chip de filtre réutilisable (piloté par URL). Style commun à toutes les pages.
export function FilterChip({
  href,
  active,
  glyph,
  glyphColor,
  children,
}: {
  href: string;
  active: boolean;
  glyph?: string;
  glyphColor?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap transition hover:-translate-y-0.5",
        active
          ? "border-carmin bg-carmin/12 text-blanc-casse"
          : "border-charbon-500 bg-charbon-800 text-texte-muet hover:text-blanc-casse",
      ].join(" ")}
    >
      {glyph && <span style={{ color: glyphColor }}>{glyph}</span>}
      {children}
    </Link>
  );
}

export interface FilterOption {
  value: string;
  label: string;
  glyph?: string;
  glyphColor?: string;
  count?: number;
}

/**
 * Groupe de chips pour un paramètre d'URL : un chip "Tout" + un chip par option.
 * Décorrélé d'une page précise — fournit pathname + params courants + clé de param.
 */
export function FilterChipGroup({
  label,
  paramKey,
  allLabel,
  options,
  current,
  pathname,
  params,
}: {
  label?: string;
  paramKey: string;
  allLabel: string;
  options: FilterOption[];
  current?: string;
  pathname: string;
  params: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && (
        <span className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{label}</span>
      )}
      <FilterChip href={buildHref(pathname, params, { [paramKey]: undefined })} active={!current}>
        {allLabel}
      </FilterChip>
      {options.map((o) => (
        <FilterChip
          key={o.value}
          href={buildHref(pathname, params, { [paramKey]: o.value })}
          active={current === o.value}
          glyph={o.glyph}
          glyphColor={o.glyphColor}
        >
          {o.label}
          {typeof o.count === "number" && <span className="opacity-55"> {o.count}</span>}
        </FilterChip>
      ))}
    </div>
  );
}
