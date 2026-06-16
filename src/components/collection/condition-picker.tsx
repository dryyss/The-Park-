"use client";

import { useTranslations } from "next-intl";
import { CONDITION_ORDER, conditionColor, type ConditionCode } from "@/lib/condition";

export function ConditionPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: ConditionCode;
  onChange: (code: ConditionCode) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("collection");
  const tc = useTranslations("conditions");

  if (compact) {
    return (
      <label className="flex w-full flex-col gap-1">
        <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("conditionLabel")}</span>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as ConditionCode)}
          className="w-full cursor-pointer rounded-md border border-charbon-500 bg-charbon-700 px-2 py-1 text-[10.5px] font-extrabold text-blanc-casse outline-none focus:border-carmin disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: conditionColor(value) }}
        >
          {CONDITION_ORDER.map((code) => (
            <option key={code} value={code}>
              {tc(code)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("conditionLabel")}</span>
      <div className="flex flex-wrap gap-1.5">
        {CONDITION_ORDER.map((code) => (
          <button
            key={code}
            type="button"
            disabled={disabled}
            onClick={() => onChange(code)}
            className={[
              "rounded-md border px-2.5 py-1 text-[10.5px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50",
              value === code
                ? "border-carmin bg-carmin/15 text-blanc-casse"
                : "border-charbon-500 text-texte-dim hover:border-charbon-400",
            ].join(" ")}
            style={value === code ? { color: conditionColor(code) } : undefined}
          >
            {tc(code)}
          </button>
        ))}
      </div>
    </div>
  );
}
