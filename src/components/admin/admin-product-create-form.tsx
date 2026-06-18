"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createProductAction } from "@/server/admin/shop.actions";

export function AdminProductCreateForm() {
  const t = useTranslations("admin.shop");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createProductAction({
        sku: String(form.get("sku")),
        slug: String(form.get("slug")),
        name: String(form.get("name")),
        type: String(form.get("type")) as "BOOSTER" | "DISPLAY" | "STARTER_DECK" | "PROMO_PACK" | "MERCH" | "LIMITED_EDITION",
        price: parseFloat(String(form.get("price")).replace(",", ".")),
        stock: parseInt(String(form.get("stock")), 10),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 font-display rounded-lg border border-dashed border-or/50 px-4 py-2 text-[12px] tracking-wide text-or uppercase hover:bg-or/10"
      >
        + {t("createProduct")}
      </button>
    );
  }

  return (
    <form action={(fd) => submit(fd)} className="mb-6 rounded-[16px] border border-or/30 bg-charbon-800 p-5">
      <h3 className="font-display text-[14px] tracking-wide text-or uppercase">{t("createProduct")}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input name="sku" required placeholder={t("sku")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse" />
        <input name="slug" required placeholder="slug-url" className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse" />
        <input name="name" required placeholder={t("name")} className="sm:col-span-2 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse" />
        <select name="type" className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse">
          <option value="BOOSTER">Booster</option>
          <option value="DISPLAY">Display</option>
          <option value="LIMITED_EDITION">Édition limitée</option>
          <option value="MERCH">Merch</option>
        </select>
        <input name="price" type="number" step="0.01" required placeholder={t("price")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-or" />
        <input name="stock" type="number" required defaultValue={0} placeholder={t("stock")} className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse" />
      </div>
      {error && <p className="mt-2 text-[12px] font-bold text-neon-rouge">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-or px-4 py-2 text-[11px] font-extrabold text-charbon uppercase disabled:opacity-50">
          {t("create")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-charbon-500 px-4 py-2 text-[11px] font-extrabold text-texte-dim uppercase">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
