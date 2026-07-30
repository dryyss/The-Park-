"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PlatformConfigView } from "@/server/platform/platform.service";
import { updatePlatformConfigAction } from "@/server/admin/platform.actions";

/** Parse un nombre saisi en tolérant la virgule décimale ; jamais NaN. */
function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AdminPlatformSettings({ config }: { config: PlatformConfigView }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);

  function save(form: FormData) {
    setStatus(null);
    startTransition(async () => {
      const result = await updatePlatformConfigAction({
        shopFreeShippingMin: parseNumber(form.get("shopFreeShippingMin"), config.shopShipping.freeShippingMin),
        shopStandardShipping: parseNumber(form.get("shopStandardShipping"), config.shopShipping.standardShipping),
        shopDefaultCarrier: String(form.get("shopDefaultCarrier")),
        demoUserSlug: String(form.get("demoUserSlug") || "") || null,
        listingDefaultDays: parseNumber(form.get("listingDefaultDays"), config.listingDefaultDays),
        // Champ vidé = section masquée : on renvoie null plutôt qu'une chaîne vide.
        introVideoUrl: String(form.get("introVideoUrl") || "") || null,
        introVideoPosterUrl: String(form.get("introVideoPosterUrl") || "") || null,
        introVideoPlacement: String(form.get("introVideoPlacement") || "intro"),
      });
      if (!result.ok) {
        setStatus({ type: "error", message: result.error === "VALIDATION" ? t("saveValidation") : t("saveError") });
        return;
      }
      setStatus({ type: "ok", message: t("saved") });
      router.refresh();
    });
  }

  return (
    <form action={(fd) => save(fd)} className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-6">
      <h2 className="font-display text-[18px] tracking-wide text-blanc-casse uppercase">{t("shippingTitle")}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("freeMin")}</span>
          <input
            name="shopFreeShippingMin"
            type="number"
            step="0.01"
            defaultValue={config.shopShipping.freeShippingMin}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("standardFee")}</span>
          <input
            name="shopStandardShipping"
            type="number"
            step="0.01"
            defaultValue={config.shopShipping.standardShipping}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("carrier")}</span>
          <input
            name="shopDefaultCarrier"
            defaultValue={config.shopShipping.defaultCarrier}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("listingDays")}</span>
          <input
            name="listingDefaultDays"
            type="number"
            defaultValue={config.listingDefaultDays}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("demoSlug")}</span>
          <input
            name="demoUserSlug"
            defaultValue={config.demoUserSlug ?? ""}
            placeholder={t("demoSlugHint")}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("introVideoUrl")}</span>
          <input
            name="introVideoUrl"
            defaultValue={config.introVideo?.url ?? ""}
            placeholder={t("introVideoUrlHint")}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("introVideoPoster")}</span>
          <input
            name="introVideoPosterUrl"
            defaultValue={config.introVideo?.posterUrl ?? ""}
            placeholder={t("introVideoPosterHint")}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("introVideoPlacement")}</span>
          <select
            name="introVideoPlacement"
            defaultValue={config.introVideo?.placement ?? "intro"}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
          >
            <option value="intro" className="bg-charbon-800">{t("introVideoPlacementIntro")}</option>
            <option value="section" className="bg-charbon-800">{t("introVideoPlacementSection")}</option>
          </select>
        </label>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-carmin px-5 py-2.5 text-[12px] font-extrabold text-white uppercase disabled:opacity-50"
        >
          {pending ? t("saving") : t("save")}
        </button>
        {status && (
          <span
            role="status"
            className={`text-[12px] font-semibold ${status.type === "ok" ? "text-emerald-400" : "text-carmin-alt"}`}
          >
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}
