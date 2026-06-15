"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminOrderRow } from "@/server/admin/admin.mutations";
import { updateOrderStatusAction } from "@/server/admin/shop.actions";

const STATUSES = ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export function AdminOrdersPanel({ orders }: { orders: AdminOrderRow[] }) {
  const t = useTranslations("admin.orders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function updateStatus(orderId: string, status: (typeof STATUSES)[number]) {
    startTransition(async () => {
      await updateOrderStatusAction({ orderId, status });
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
            <th className="px-4 py-3">{t("number")}</th>
            <th className="px-4 py-3">{t("customer")}</th>
            <th className="px-4 py-3">{t("total")}</th>
            <th className="px-4 py-3">{t("items")}</th>
            <th className="px-4 py-3">{t("status")}</th>
            <th className="px-4 py-3">{t("date")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-charbon-600/50">
              <td className="px-4 py-3 font-mono text-[12px]">{o.orderNumber}</td>
              <td className="px-4 py-3 font-extrabold text-blanc-casse">{o.customerName}</td>
              <td className="px-4 py-3 text-or">{o.total}</td>
              <td className="px-4 py-3">{o.itemCount}</td>
              <td className="px-4 py-3">
                <select
                  defaultValue={o.status}
                  disabled={pending}
                  onChange={(e) => updateStatus(o.id, e.target.value as (typeof STATUSES)[number])}
                  className="rounded border border-charbon-500 bg-charbon-700 px-2 py-1 text-[12px]"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-[12px] text-texte-dim">{o.createdAt.toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>}
    </div>
  );
}
