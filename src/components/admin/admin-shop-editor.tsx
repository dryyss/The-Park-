"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminShopProduct } from "@/server/admin/admin.service";
import { updateProductAction } from "@/server/admin/shop.actions";

export function AdminShopEditor({ products }: { products: AdminShopProduct[] }) {
  const t = useTranslations("admin.shop");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save(productId: string, form: FormData) {
    setMessage(null);
    const price = parseFloat(String(form.get("price")).replace(",", "."));
    const stock = parseInt(String(form.get("stock")), 10);
    const active = form.get("active") === "on";
    startTransition(async () => {
      const res = await updateProductAction({
        productId,
        name: String(form.get("name")),
        price,
        stock,
        active,
      });
      if (res.ok) {
        setMessage(t("saveSuccess"));
        router.refresh();
      } else {
        setMessage(t("saveError"));
      }
    });
  }

  return (
    <div>
      {message && <p className="mb-4 text-center text-[13px] font-bold text-blanc-casse">{message}</p>}
      <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              <th className="px-4 py-3">{t("sku")}</th>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("price")}</th>
              <th className="px-4 py-3">{t("stock")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-charbon-600/50">
                <td className="px-4 py-3 font-mono text-[12px] text-texte-dim">{p.sku}</td>
                <td className="px-4 py-3">
                  <form id={`form-${p.id}`} action={(fd) => save(p.id, fd)} className="flex flex-col gap-1">
                    <input name="name" defaultValue={p.name} className="rounded border border-charbon-500 bg-charbon-700 px-2 py-1 text-blanc-casse" />
                  </form>
                </td>
                <td className="px-4 py-3">
                  <input form={`form-${p.id}`} name="price" type="number" step="0.01" defaultValue={p.priceValue} className="w-24 rounded border border-charbon-500 bg-charbon-700 px-2 py-1 text-or" />
                </td>
                <td className="px-4 py-3">
                  <input form={`form-${p.id}`} name="stock" type="number" defaultValue={p.stock} className="w-20 rounded border border-charbon-500 bg-charbon-700 px-2 py-1" />
                </td>
                <td className="px-4 py-3">
                  <label className="flex items-center gap-2 text-[12px]">
                    <input form={`form-${p.id}`} name="active" type="checkbox" defaultChecked={p.active} />
                    {p.active ? t("active") : t("inactive")}
                  </label>
                </td>
                <td className="px-4 py-3">
                  <button form={`form-${p.id}`} type="submit" disabled={pending} className="rounded-lg bg-or px-3 py-1.5 text-[11px] font-extrabold text-charbon uppercase disabled:opacity-50">
                    {t("save")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
