"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateCollectionEditionAction } from "@/server/collection/collection.actions";
import { isFirstEditionLabel } from "@/lib/card-edition";

type Preset = "first" | "unlimited";

function presetFromLabels(
  userEditionLabel: string | null,
  catalogEditionLabel: string | null,
): Preset {
  const effective = userEditionLabel ?? catalogEditionLabel;
  if (effective && isFirstEditionLabel(effective)) return "first";
  return "unlimited";
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
  const [error, setError] = useState<string | null>(null);

  if (!owned) {
    return (
      <p className="text-[10.5px] font-bold text-texte-faible">
        {catalogEditionLabel ? t("editionCatalog", { label: catalogEditionLabel }) : t("editionReedition")}
      </p>
    );
  }

  function save(nextPreset: Preset) {
    setError(null);
    startTransition(async () => {
      const res = await updateCollectionEditionAction({ variantId, preset: nextPreset });
      if (!res.ok) setError(t("editionError"));
      else router.refresh();
    });
  }

  return (
    <div className="mt-2 flex w-full min-w-[200px] flex-col gap-1.5">
      <label className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("editionLabel")}</label>
      <div className="flex flex-wrap gap-1.5">
        {(["first", "unlimited"] as const).map((key) => (
          <button
            key={key}
            type="button"
            disabled={pending}
            onClick={() => {
              setPreset(key);
              save(key);
            }}
            className={[
              "rounded-md border px-2.5 py-1 text-[10.5px] font-extrabold transition disabled:opacity-50",
              preset === key ? "border-carmin bg-carmin/15 text-blanc-casse" : "border-charbon-500 text-texte-dim hover:border-charbon-400",
            ].join(" ")}
          >
            {key === "first" ? t("editionFirst") : t("editionReedition")}
          </button>
        ))}
      </div>
      {editionLabel && (
        <p className="text-[10px] font-bold text-texte-faible">
          {isFirstEditionLabel(editionLabel) ? t("editionActiveFirst") : t("editionActive", { label: editionLabel })}
        </p>
      )}
      {!editionLabel && preset === "unlimited" && (
        <p className="text-[10px] font-bold text-texte-faible">{t("editionActiveReedition")}</p>
      )}
      {error && <p className="text-[10px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
