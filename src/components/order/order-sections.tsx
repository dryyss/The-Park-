import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { OrderDetail, OrderListItem } from "@/server/order/order.service";

const STATUS_KEYS: Record<string, string> = {
  PENDING: "pending",
  PAID: "paid",
  PREPARING: "preparing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

export async function OrderList({ orders }: { orders: OrderListItem[] }) {
  const t = await getTranslations("orders");

  if (orders.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
        <Link href="/boutique" className="mt-4 inline-block text-[13px] font-extrabold text-carmin hover:underline">
          {t("shopCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/boutique/commandes/${o.id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-charbon-500 bg-charbon-800 p-4 transition hover:border-carmin"
        >
          <div>
            <p className="font-mono text-[13px] font-extrabold text-or">{o.orderNumber}</p>
            <p className="text-[12px] font-bold text-texte-dim">
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(o.createdAt)} · {t("itemCount", { count: o.itemCount })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-md bg-charbon-700 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">
              {t(`status.${STATUS_KEYS[o.status] ?? o.status}`)}
            </span>
            <span className="font-display text-[18px] text-blanc-casse">{o.total}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export async function OrderDetailPanel({ order }: { order: OrderDetail }) {
  const t = await getTranslations("orders");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <p className="font-mono text-[14px] font-extrabold text-or">{order.orderNumber}</p>
        <p className="mt-1 text-[12px] font-bold text-texte-dim">
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(order.createdAt)}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {order.lines.map((l) => (
            <div key={l.id} className="flex justify-between rounded-lg bg-charbon-700 px-4 py-3">
              <span className="text-[13px] font-extrabold text-blanc-casse">
                {l.productName} × {l.quantity}
              </span>
              <span className="text-[13px] font-bold text-or">{l.lineTotal}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-fit rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h3 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">{t("summary")}</h3>
        <div className="mt-4 flex flex-col gap-2 text-[13px] font-bold text-texte-dim">
          <div className="flex justify-between"><span>{t("subtotal")}</span><span>{order.subtotal}</span></div>
          <div className="flex justify-between"><span>{t("shipping")}</span><span>{order.shippingCost}</span></div>
          <div className="flex justify-between border-t border-charbon-500 pt-2 text-blanc-casse">
            <span>{t("total")}</span>
            <span className="font-display text-[18px] text-or">{order.total}</span>
          </div>
        </div>
        {order.shippingName && (
          <div className="mt-5 border-t border-charbon-500 pt-4">
            <p className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("shippingTo")}</p>
            <p className="mt-1 text-[13px] font-bold text-blanc-casse">{order.shippingName}</p>
            {order.shippingCity && <p className="text-[12px] text-texte-dim">{order.shippingCity}</p>}
          </div>
        )}
        {order.trackingNumber && (
          <p className="mt-3 font-mono text-[12px] text-carmin">{t("tracking")}: {order.trackingNumber}</p>
        )}
        <Link href="/boutique/commandes" className="mt-5 inline-block text-[12px] font-extrabold text-carmin hover:underline">
          ← {t("back")}
        </Link>
      </div>
    </div>
  );
}
