"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PlatformConfigView } from "@/server/platform/platform.service";
import { updatePlatformConfigAction } from "@/server/admin/platform.actions";

export function AdminPlatformSettings({ config }: { config: PlatformConfigView }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(form: FormData) {
    startTransition(async () => {
      await updatePlatformConfigAction({
        shopFreeShippingMin: Number(form.get("shopFreeShippingMin")),
        shopStandardShipping: Number(form.get("shopStandardShipping")),
        shopDefaultCarrier: String(form.get("shopDefaultCarrier")),
        demoUserSlug: String(form.get("demoUserSlug") || "") || null,
        listingDefaultDays: Number(form.get("listingDefaultDays")),
        // Champ vidé = section masquée : on renvoie null plutôt qu'une chaîne vide.
        introVideoUrl: String(form.get("introVideoUrl") || "") || null,
        introVideoPosterUrl: String(form.get("introVideoPosterUrl") || "") || null,
        introVideoPlacement: String(form.get("introVideoPlacement") || "intro"),
      });
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
      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-lg bg-carmin px-5 py-2.5 text-[12px] font-extrabold text-white uppercase disabled:opacity-50"
      >
        {t("save")}
      </button>
    </form>
  );
}
