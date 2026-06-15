"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminSeasonRow } from "@/server/admin/admin.mutations";
import { updateSeasonAction } from "@/server/admin/shop.actions";

export function AdminCatalogPanel({ seasons }: { seasons: AdminSeasonRow[] }) {
  const t = useTranslations("admin.catalog");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(seasonId: string, form: FormData) {
    startTransition(async () => {
      const releaseRaw = String(form.get("releaseDate"));
      await updateSeasonAction({
        seasonId,
        name: String(form.get("name")),
        releaseDate: releaseRaw ? new Date(releaseRaw).toISOString() : null,
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {seasons.map((s) => (
        <form
          key={s.id}
          action={(fd) => save(s.id, fd)}
          className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("code")}</label>
              <p className="font-mono text-[14px] text-or">{s.code}</p>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("name")}</label>
              <input name="name" defaultValue={s.name} className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("cards")}</label>
              <p className="text-[14px] font-bold text-blanc-casse">{s.cardCount}</p>
            </div>
            <div>
              <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("release")}</label>
              <input
                name="releaseDate"
                type="datetime-local"
                defaultValue={s.releaseDate ? s.releaseDate.toISOString().slice(0, 16) : ""}
                className="mt-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse"
              />
            </div>
            <button type="submit" disabled={pending} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase disabled:opacity-50">
              {t("save")}
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
