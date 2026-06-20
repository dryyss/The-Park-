"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export const adminFilterInputCls =
  "mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin";

export const adminFilterSelectCls = adminFilterInputCls;

export function AdminFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  onApply,
  onReset,
  live,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onApply?: () => void;
  onReset?: () => void;
  /** Filtre instantané (pas de bouton Appliquer). */
  live?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations("admin.filters");

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[14px] border border-charbon-500/80 bg-charbon-800/60 p-4">
      <div className="min-w-[200px] flex-1">
        <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("search")}</label>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onApply) onApply();
          }}
          placeholder={searchPlaceholder}
          className={adminFilterInputCls}
        />
      </div>
      {children}
      {!live && onApply && (
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-carmin px-4 py-2 text-[11px] font-extrabold text-white uppercase"
        >
          {t("apply")}
        </button>
      )}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-charbon-500 px-4 py-2 text-[11px] font-extrabold text-texte-dim uppercase hover:text-blanc-casse"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}

export function AdminFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[140px]">
      <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={adminFilterSelectCls}>
        {options.map((opt) => (
          <option key={opt.value || "__all"} value={opt.value} className="bg-charbon-800">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminFilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 pb-2 text-[12px] font-bold text-texte-doux">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-carmin"
      />
      {label}
    </label>
  );
}

export function matchAdminSearch(q: string, ...parts: (string | number | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => String(part ?? "").toLowerCase().includes(needle));
}
