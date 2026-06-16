"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateCollectionEditionAction } from "@/server/collection/collection.actions";
import { isFirstEditionLabel } from "@/lib/card-edition";

type Preset = "first" | "unlimited" | "custom";

function presetFromLabels(
  userEditionLabel: string | null,
  catalogEditionLabel: string | null,
): Preset {
  const effective = userEditionLabel ?? catalogEditionLabel;
  if (!effective) return "unlimited";
  if (isFirstEditionLabel(effective)) return "first";
  return "custom";
}

export function VariantEditionEditor({
  variantId,
  owned,
  userEditionLabel,
  catalogEditionLabel,
  editionLabel,
}: {
  variantId: string;
  owned: boolean;
  userEditionLabel: string | null;
  catalogEditionLabel: string | null;
  editionLabel: string | null;
}) {
  const t = useTranslations("card");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preset, setPreset] = useState<Preset>(() =>
    presetFromLabels(userEditionLabel, catalogEditionLabel),
  );
  const [customLabel, setCustomLabel] = useState(
    () => userEditionLabel ?? (presetFromLabels(userEditionLabel, catalogEditionLabel) === "custom" ? catalogEditionLabel ?? "" : ""),
  );
  const [error, setError] = useState<string | null>(null);

  if (!owned) {
    return (
      <p className="text-[10.5px] font-bold text-texte-faible">
        {catalogEditionLabel ? t("editionCatalog", { label: catalogEditionLabel }) : t("editionUnlimited")}
      </p>
    );
  }

  function save(nextPreset: Preset, nextCustom?: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateCollectionEditionAction({
        variantId,
        preset: nextPreset,
        customLabel: nextCustom ?? customLabel,
      });
      if (!res.ok) setError(t("editionError"));
      else router.refresh();
    });
  }

  return (
    <div className="mt-2 flex w-full min-w-[200px] flex-col gap-1.5">
      <label className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("editionLabel")}</label>
      <div className="flex flex-wrap gap-1.5">
        {(["first", "unlimited", "custom"] as const).map((key) => (
          <button
            key={key}
            type="button"
            disabled={pending}
            onClick={() => {
              setPreset(key);
              if (key !== "custom") save(key);
            }}
            className={[
              "rounded-md border px-2.5 py-1 text-[10.5px] font-extrabold transition disabled:opacity-50",
              preset === key ? "border-carmin bg-carmin/15 text-blanc-casse" : "border-charbon-500 text-texte-dim hover:border-charbon-400",
            ].join(" ")}
          >
            {key === "first" ? t("editionFirst") : key === "unlimited" ? t("editionUnlimited") : t("editionCustom")}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder={t("editionCustomPlaceholder")}
            maxLength={64}
            className="min-w-0 flex-1 rounded-md border border-charbon-500 bg-charbon px-2.5 py-1.5 text-[11px] text-blanc-casse outline-none focus:border-carmin"
          />
          <button
            type="button"
            disabled={pending || !customLabel.trim()}
            onClick={() => save("custom")}
            className="rounded-md border border-charbon-500 px-2.5 py-1.5 text-[10.5px] font-extrabold text-carmin hover:border-carmin disabled:opacity-50"
          >
            {t("editionSave")}
          </button>
        </div>
      )}
      {editionLabel && (
        <p className="text-[10px] font-bold text-texte-faible">
          {isFirstEditionLabel(editionLabel) ? t("editionActiveFirst") : t("editionActive", { label: editionLabel })}
        </p>
      )}
      {!editionLabel && preset === "unlimited" && (
        <p className="text-[10px] font-bold text-texte-faible">{t("editionActiveUnlimited")}</p>
      )}
      {error && <p className="text-[10px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
