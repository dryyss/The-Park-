"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createProductAction } from "@/server/admin/shop.actions";
import {
  AdminProductImagesField,
  fromDatetimeLocalValue,
  normalizeProductImages,
} from "@/components/admin/admin-product-images-field";

const PRODUCT_TYPES = [
  "BOOSTER",
  "DISPLAY",
  "STARTER_DECK",
  "PROMO_PACK",
  "MERCH",
  "LIMITED_EDITION",
] as const;

const inputCls =
  "rounded-lg border border-charbon-500 bg-charbon-700/80 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-or/60";

const textareaCls =
  "w-full resize-y rounded-lg border border-charbon-500 bg-charbon-700/80 px-3 py-2 text-[13px] leading-relaxed text-blanc-casse outline-none focus:border-or/60";

export function AdminProductCreateForm() {
  const t = useTranslations("admin.shop");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [releaseDateLocal, setReleaseDateLocal] = useState("");

  function resetForm() {
    setDescription("");
    setImages([]);
    setReleaseDateLocal("");
    setError(null);
  }

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createProductAction({
        sku: String(form.get("sku")),
        slug: String(form.get("slug")),
        name: String(form.get("name")),
        type: String(form.get("type")) as (typeof PRODUCT_TYPES)[number],
        price: parseFloat(String(form.get("price")).replace(",", ".")),
        stock: parseInt(String(form.get("stock")), 10),
        description: description.trim() || null,
        images: normalizeProductImages(images),
        releaseDate: fromDatetimeLocalValue(releaseDateLocal),
      });
      if (res.ok) {
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-dashed border-or/50 px-4 py-2 text-[12px] tracking-wide text-or uppercase transition hover:bg-or/10"
        >
          + {t("createProduct")}
        </button>
      </div>
    );
  }

  return (
    <form action={(fd) => submit(fd)} className="admin-panel space-y-4 border-or/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="admin-section-title">{t("createProduct")}</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase hover:text-blanc-casse"
        >
          {t("cancel")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("sku")}</span>
          <input name="sku" required className={inputCls} />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("slug")}</span>
          <input name="slug" required placeholder="booster-saison-1" className={inputCls} />
        </label>
        <label className="grid gap-1 sm:col-span-2 lg:col-span-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("type")}</span>
          <select name="type" defaultValue="BOOSTER" className={inputCls}>
            {PRODUCT_TYPES.map((type) => (
              <option key={type} value={type} className="bg-charbon-800">
                {t(`productTypes.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 sm:col-span-2">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("name")}</span>
          <input name="name" required className={inputCls} />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("price")}</span>
          <input name="price" type="number" step="0.01" min={0} required className={`${inputCls} text-or`} />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("stock")}</span>
          <input name="stock" type="number" min={0} required defaultValue={0} className={inputCls} />
        </label>
        <label className="grid gap-1 sm:col-span-2 lg:col-span-3">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("releaseDate")}</span>
          <input
            type="datetime-local"
            value={releaseDateLocal}
            onChange={(e) => setReleaseDateLocal(e.target.value)}
            className={`${inputCls} max-w-xs`}
          />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("description")}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={t("descriptionPlaceholder")}
          className={textareaCls}
        />
      </label>

      <AdminProductImagesField images={images} onChange={setImages} />

      {error && <p className="text-[12px] font-bold text-neon-rouge">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-or px-4 py-2 text-[11px] font-extrabold text-charbon uppercase disabled:opacity-50"
        >
          {t("create")}
        </button>
      </div>
    </form>
  );
}
