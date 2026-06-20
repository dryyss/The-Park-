"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminShopProduct } from "@/server/admin/admin.service";
import { updateProductAction } from "@/server/admin/shop.actions";

const inputCls =
  "w-full rounded-md border border-charbon-500 bg-charbon-700/80 px-2 py-1.5 text-[12px] text-blanc-casse outline-none transition focus:border-or/60";

function parsePrice(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ShopProductRow({ product }: { product: AdminShopProduct }) {
  const t = useTranslations("admin.shop");
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.priceValue));
  const [stock, setStock] = useState(String(product.stock));
  const [active, setActive] = useState(product.active);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    setName(product.name);
    setPrice(String(product.priceValue));
    setStock(String(product.stock));
    setActive(product.active);
    setFeedback(null);
  }, [product]);

  const priceNum = parsePrice(price);
  const stockNum = parseInt(stock, 10);
  const dirty =
    name.trim() !== product.name ||
    priceNum !== product.priceValue ||
    stockNum !== product.stock ||
    active !== product.active;
  const valid =
    name.trim().length > 0 &&
    priceNum !== null &&
    priceNum >= 0 &&
    Number.isFinite(stockNum) &&
    stockNum >= 0;

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
    setFeedback(null);
  }

  const lowStock = Number.isFinite(stockNum) && stockNum <= 5;

  return (
    <tr
      className={`border-b border-charbon-600/50 transition-colors ${dirty ? "bg-or/5" : "hover:bg-charbon-700/30"}`}
    >
      <td className="px-3 py-2.5 align-middle">
        <span className="font-mono text-[11px] text-texte-dim">{product.sku}</span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={t("name")}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          aria-label={t("price")}
          className={`${inputCls} max-w-[88px] tabular-nums text-or`}
        />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <input
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          type="number"
          min={0}
          aria-label={t("stock")}
          className={`${inputCls} max-w-[72px] tabular-nums ${lowStock ? "border-neon-orange/50 text-neon-orange" : ""}`}
        />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-or"
          />
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
              active ? "bg-neon-vert/15 text-neon-vert" : "bg-charbon-600 text-texte-faible"
            }`}
          >
            {active ? t("active") : t("inactive")}
          </span>
        </label>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <form onSubmit={save} className="flex items-center gap-1.5">
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
          ) : (
            <span className="text-[11px] text-texte-faible">—</span>
          )}
        </form>
      </td>
    </tr>
  );
}

export function AdminShopEditor({ products }: { products: AdminShopProduct[] }) {
  const t = useTranslations("admin.shop");
  const activeCount = products.filter((p) => p.active).length;
  const lowStockCount = products.filter((p) => p.active && p.stock <= 5).length;

  return (
    <section className="admin-panel overflow-hidden !p-0">
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

      {products.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-charbon-500 text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">
                <th className="px-3 py-2.5">{t("sku")}</th>
                <th className="px-3 py-2.5">{t("name")}</th>
                <th className="px-3 py-2.5">{t("price")}</th>
                <th className="px-3 py-2.5">{t("stock")}</th>
                <th className="px-3 py-2.5">{t("status")}</th>
                <th className="px-3 py-2.5 w-[140px]">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ShopProductRow key={p.id} product={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
