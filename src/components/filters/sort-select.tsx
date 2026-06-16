"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { buildHref } from "@/lib/query";

// Menu de tri réutilisable, piloté par URL (navigue au changement).
export function SortSelect({
  label,
  paramKey = "sort",
  value,
  options,
  params,
}: {
  label: string;
  paramKey?: string;
  value: string;
  options: { value: string; label: string }[];
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2">
      <span className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => router.push(buildHref(pathname, params, { [paramKey]: e.target.value || undefined }))}
        className="rounded-full border border-charbon-500 bg-charbon-800 px-3.5 py-1.5 text-[11.5px] font-bold text-blanc-casse outline-none focus:border-carmin"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-charbon-800">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
