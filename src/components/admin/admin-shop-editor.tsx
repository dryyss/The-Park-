"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cardImage } from "@/lib/rarity";
import type { AdminShopProduct } from "@/server/admin/admin.service";
import { updateProductAction } from "@/server/admin/shop.actions";
import {
  AdminProductImagesField,
  fromDatetimeLocalValue,
  normalizeProductImages,
  productImagesEqual,
  releaseDatesEqual,
  toDatetimeLocalValue,
} from "@/components/admin/admin-product-images-field";
import { AdminFilterBar, AdminFilterSelect, matchAdminSearch } from "@/components/admin/admin-filter-bar";
import type { ProductType } from "@/generated/prisma/client";
import type { AdminImageUploadMode } from "@/lib/admin-image-upload.types";

const inputCls =
  "w-full rounded-md border border-charbon-500 bg-charbon-700/80 px-2 py-1.5 text-[12px] text-blanc-casse outline-none transition focus:border-or/60";

const textareaCls =
  "w-full resize-y rounded-md border border-charbon-500 bg-charbon-700/80 px-3 py-2 text-[13px] leading-relaxed text-blanc-casse outline-none focus:border-or/60";

function parsePrice(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ShopProductPanel({ product, uploadMode }: { product: AdminShopProduct; uploadMode: AdminImageUploadMode }) {
  const t = useTranslations("admin.shop");
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.priceValue));
  const [stock, setStock] = useState(String(product.stock));
  const [active, setActive] = useState(product.active);
  const [description, setDescription] = useState(product.description ?? "");
  const [images, setImages] = useState<string[]>(product.images.length > 0 ? product.images : []);
  const [releaseDateLocal, setReleaseDateLocal] = useState(toDatetimeLocalValue(product.releaseDate));
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    setName(product.name);
    setPrice(String(product.priceValue));
    setStock(String(product.stock));
    setActive(product.active);
    setDescription(product.description ?? "");
    setImages(product.images.length > 0 ? product.images : []);
    setReleaseDateLocal(toDatetimeLocalValue(product.releaseDate));
    setFeedback(null);
  }, [product]);

  const priceNum = parsePrice(price);
  const stockNum = parseInt(stock, 10);
  const normalizedImages = normalizeProductImages(images);
  const releaseDateIso = fromDatetimeLocalValue(releaseDateLocal);
  const descriptionValue = description.trim() || null;

  const dirty =
    name.trim() !== product.name ||
    priceNum !== product.priceValue ||
    stockNum !== product.stock ||
    active !== product.active ||
    descriptionValue !== (product.description?.trim() || null) ||
    !productImagesEqual(images, product.images) ||
    !releaseDatesEqual(product.releaseDate, releaseDateLocal);

  const valid =
    name.trim().length > 0 &&
    priceNum !== null &&
    priceNum >= 0 &&
    Number.isFinite(stockNum) &&
    stockNum >= 0 &&
    description.length <= 4000;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || !valid || priceNum === null) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateProductAction({
        productId: product.id,
        name: name.trim(),
        price: priceNum,
        stock: stockNum,
        active,
        description: descriptionValue,
        images: normalizedImages,
        releaseDate: releaseDateIso,
      });
      if (res.ok) {
        setFeedback("success");
        router.refresh();
        window.setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback("error");
      }
    });
  }

  function revert() {
    setName(product.name);
    setPrice(String(product.priceValue));
    setStock(String(product.stock));
    setActive(product.active);
    setDescription(product.description ?? "");
    setImages(product.images.length > 0 ? product.images : []);
    setReleaseDateLocal(toDatetimeLocalValue(product.releaseDate));
    setFeedback(null);
  }

  const lowStock = Number.isFinite(stockNum) && stockNum <= 5;
  const thumb = product.images[0] ? cardImage(product.images[0]) : null;

  return (
    <article className={`border-b border-charbon-600/50 ${dirty ? "bg-or/5" : ""}`}>
      <form onSubmit={save}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-charbon-500 bg-charbon-900"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[9px] font-bold text-texte-faible">—</span>
            )}
          </button>

          <div className="min-w-[120px] flex-1">
            <p className="font-mono text-[10px] text-texte-dim">{product.sku}</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t("name")}
              className={`${inputCls} mt-1 font-bold`}
            />
            <p className="mt-1 text-[10px] text-texte-faible">
              {t(`productTypes.${product.type}`)} · /{product.slug}
            </p>
          </div>

          <label className="grid w-[88px] gap-1">
            <span className="text-[9px] font-extrabold tracking-wide text-texte-dim uppercase">{t("price")}</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className={`${inputCls} tabular-nums text-or`}
            />
          </label>

          <label className="grid w-[72px] gap-1">
            <span className="text-[9px] font-extrabold tracking-wide text-texte-dim uppercase">{t("stock")}</span>
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              type="number"
              min={0}
              className={`${inputCls} tabular-nums ${lowStock ? "border-neon-orange/50 text-neon-orange" : ""}`}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-or" />
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                active ? "bg-neon-vert/15 text-neon-vert" : "bg-charbon-600 text-texte-faible"
              }`}
            >
              {active ? t("active") : t("inactive")}
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-charbon-500 px-2.5 py-1 text-[10px] font-extrabold text-texte-dim uppercase hover:text-blanc-casse"
            >
              {expanded ? t("collapse") : t("editContent")}
            </button>
            {dirty ? (
              <>
                <button
                  type="submit"
                  disabled={pending || !valid}
                  className="rounded-md bg-or px-2.5 py-1 text-[10px] font-extrabold text-charbon uppercase disabled:opacity-50"
                >
                  {pending ? "…" : t("save")}
                </button>
                <button
                  type="button"
                  onClick={revert}
                  disabled={pending}
                  className="rounded-md border border-charbon-500 px-2 py-1 text-[10px] font-extrabold text-texte-dim uppercase hover:text-blanc-casse disabled:opacity-50"
                >
                  {t("revert")}
                </button>
              </>
            ) : feedback === "success" ? (
              <span className="text-[11px] font-bold text-neon-vert">{t("saved")}</span>
            ) : feedback === "error" ? (
              <span className="text-[11px] font-bold text-neon-rouge">{t("saveError")}</span>
            ) : null}
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 border-t border-charbon-600/50 bg-charbon-800/50 px-4 py-4">
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
              <span className="text-right text-[10px] text-texte-faible">{description.length}/4000</span>
            </label>

            <label className="grid max-w-xs gap-1.5">
              <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("releaseDate")}</span>
              <input
                type="datetime-local"
                value={releaseDateLocal}
                onChange={(e) => setReleaseDateLocal(e.target.value)}
                className={inputCls}
              />
              <span className="text-[11px] text-texte-faible">{t("releaseDateHint")}</span>
            </label>

            <AdminProductImagesField images={images} onChange={setImages} uploadMode={uploadMode} />
          </div>
        )}
      </form>
    </article>
  );
}

export function AdminShopEditor({ products, uploadMode }: { products: AdminShopProduct[]; uploadMode: AdminImageUploadMode }) {
  const t = useTranslations("admin.shop");
  const tFilters = useTranslations("admin.filters");
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  const productTypes = useMemo(
    () => [...new Set(products.map((p) => p.type))].sort() as ProductType[],
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (activeFilter === "active" && !p.active) return false;
        if (activeFilter === "inactive" && p.active) return false;
        if (typeFilter && p.type !== typeFilter) return false;
        if (stockFilter === "low" && !(p.active && p.stock <= 5 && p.stock > 0)) return false;
        if (stockFilter === "out" && p.stock !== 0) return false;
        return matchAdminSearch(q, p.name, p.sku, p.slug);
      }),
    [products, q, activeFilter, typeFilter, stockFilter],
  );

  const activeCount = products.filter((p) => p.active).length;
  const lowStockCount = products.filter((p) => p.active && p.stock <= 5).length;
  const hasFilters = Boolean(q.trim() || activeFilter || typeFilter || stockFilter);

  return (
    <section className="admin-panel overflow-hidden p-0!">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border px-4 py-3">
        <div>
          <h2 className="admin-section-title">{t("listTitle")}</h2>
          <p className="admin-meta mt-0.5">{t("listCount", { count: products.length, active: activeCount })}</p>
        </div>
        {lowStockCount > 0 && (
          <span className="rounded-md border border-neon-orange/40 bg-neon-orange/10 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-neon-orange uppercase">
            {t("lowStockCount", { count: lowStockCount })}
          </span>
        )}
      </div>

      <div className="border-b border-admin-border px-4 py-3">
        <AdminFilterBar
          live
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("searchPlaceholder")}
          onReset={hasFilters ? () => { setQ(""); setActiveFilter(""); setTypeFilter(""); setStockFilter(""); } : undefined}
        >
          <AdminFilterSelect
            label={t("filterActive")}
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { value: "", label: t("activeAll") },
              { value: "active", label: t("activeYes") },
              { value: "inactive", label: t("activeNo") },
            ]}
          />
          <AdminFilterSelect
            label={t("filterType")}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "", label: tFilters("all") },
              ...productTypes.map((type) => ({ value: type, label: t(`productTypes.${type}`) })),
            ]}
          />
          <AdminFilterSelect
            label={t("filterStock")}
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              { value: "", label: t("stockAll") },
              { value: "low", label: t("stockLow") },
              { value: "out", label: t("stockOut") },
            ]}
          />
        </AdminFilterBar>
        {hasFilters && (
          <p className="text-[12px] font-bold text-texte-faible">{tFilters("resultsCount", { count: filteredProducts.length })}</p>
        )}
      </div>

      {products.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>
      ) : filteredProducts.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] font-bold text-texte-dim">{tFilters("noResults")}</p>
      ) : (
        <div>{filteredProducts.map((p) => <ShopProductPanel key={p.id} product={p} uploadMode={uploadMode} />)}</div>
      )}
    </section>
  );
}
