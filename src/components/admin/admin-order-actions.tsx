"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminOrderDetail } from "@/server/admin/orders.service";
import { updateOrderFulfillmentAction } from "@/server/admin/shop.actions";

const STATUSES = ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export function AdminOrderActions({ order }: { order: AdminOrderDetail }) {
  const t = useTranslations("admin.orders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [method, setMethod] = useState(order.shippingMethod ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateOrderFulfillmentAction({
        orderId: order.id,
        status,
        trackingNumber: tracking.trim() || null,
        shippingMethod: method.trim() || null,
      });
      if (res.ok) router.refresh();
      else setError(t("errUpdate"));
    });
  }

  function markShipped() {
    setStatus("SHIPPED");
    setError(null);
    startTransition(async () => {
      const res = await updateOrderFulfillmentAction({
        orderId: order.id,
        status: "SHIPPED",
        trackingNumber: tracking.trim() || null,
        shippingMethod: method.trim() || null,
      });
      if (res.ok) router.refresh();
      else setError(t("errUpdate"));
    });
  }

  return (
    <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <h2 className="font-display text-[15px] tracking-wide text-blanc-casse uppercase">{t("fulfillmentTitle")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("status")}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            disabled={pending}
            className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-charbon-800">{t(`statuses.${s}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("shippingMethod")}</span>
          <input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder={t("shippingMethodPlaceholder")}
            disabled={pending}
            className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("trackingNumber")}</span>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder={t("trackingPlaceholder")}
            disabled={pending}
            className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 font-mono text-[13px] text-blanc-casse"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-[13px] font-bold text-neon-rouge">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-carmin px-4 py-2 text-[11px] font-extrabold text-white uppercase disabled:opacity-50"
        >
          {t("save")}
        </button>
        {(order.status === "PAID" || order.status === "PREPARING") && (
          <button
            type="button"
            disabled={pending}
            onClick={markShipped}
            className="rounded-lg border border-neon-vert/50 px-4 py-2 text-[11px] font-extrabold text-neon-vert uppercase hover:bg-neon-vert/10 disabled:opacity-50"
          >
            {t("markShipped")}
          </button>
        )}
      </div>
    </div>
  );
}
