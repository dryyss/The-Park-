import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getAdminOrderById } from "@/server/admin/orders.service";
import { AdminOrderActions } from "@/components/admin/admin-order-actions";
import type { OrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-charbon-600 text-texte-dim",
  PAID: "bg-neon-vert/15 text-neon-vert",
  PREPARING: "bg-neon-orange/15 text-neon-orange",
  SHIPPED: "bg-carmin/15 text-carmin",
  DELIVERED: "bg-neon-vert/15 text-neon-vert",
  CANCELLED: "bg-charbon-600 text-texte-faible",
  REFUNDED: "bg-neon-rouge/15 text-neon-rouge",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.orders");

  const access = await requireModule("shop");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/commandes/${id}`)}`);
    notFound();
  }

  const order = await getAdminOrderById(id);
  if (!order) notFound();

  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

  return (
    <main className="mx-auto max-w-[1100px] px-7 pt-9 pb-[60px]">
      <Link href="/admin/commandes" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("backToList")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[20px] font-extrabold text-or">{order.orderNumber}</h1>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_STYLE[order.status] ?? "bg-charbon-600 text-texte-dim"}`}>
              {t(`statuses.${order.status as OrderStatus}`)}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] font-bold text-texte-dim">
            {fmt.format(order.createdAt)}
            {order.shippedAt && ` · ${t("shippedAt")} ${fmt.format(order.shippedAt)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[24px] text-or">{order.total}</p>
          <p className="text-[11px] font-bold text-texte-dim">{t("itemCount", { count: order.itemCount })}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
            <h2 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">{t("itemsTitle")}</h2>
            <div className="mt-4 flex flex-col gap-2">
              {order.lines.map((line) => (
                <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-charbon-700 px-4 py-3">
                  <div>
                    <p className="text-[13px] font-extrabold text-blanc-casse">{line.productName}</p>
                    <p className="font-mono text-[10px] text-texte-faible">{line.productSku} · ×{line.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-or">{line.lineTotal}</p>
                    <p className="text-[10px] text-texte-dim">{line.unitPrice} / u.</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-1 border-t border-charbon-500 pt-4 text-[13px] font-bold text-texte-dim">
              <div className="flex justify-between"><span>{t("subtotal")}</span><span>{order.subtotal}</span></div>
              <div className="flex justify-between"><span>{t("shipping")}</span><span>{order.shippingCost}</span></div>
              <div className="flex justify-between border-t border-charbon-500 pt-2 text-blanc-casse">
                <span>{t("total")}</span>
                <span className="font-display text-[18px] text-or">{order.total}</span>
              </div>
            </div>
          </section>

          {order.payment && (
            <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
              <h2 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">{t("paymentTitle")}</h2>
              <dl className="mt-4 grid gap-2 text-[13px]">
                <Row label={t("paymentStatus")} value={t(`paymentStatuses.${order.payment.status}`)} />
                <Row label={t("paymentAmount")} value={order.payment.amount} highlight />
                {order.payment.stripePaymentIntentId && (
                  <Row label="Stripe PI" value={order.payment.stripePaymentIntentId} mono />
                )}
                {order.payment.capturedAt && (
                  <Row label={t("paymentCaptured")} value={fmt.format(order.payment.capturedAt)} />
                )}
              </dl>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
            <h2 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">{t("customerTitle")}</h2>
            <p className="mt-3 text-[14px] font-extrabold text-blanc-casse">
              <Link href={`/admin/utilisateurs/${order.customerId}`} className="hover:text-carmin">
                {order.customerName}
              </Link>
            </p>
            <p className="mt-1 text-[12px] font-bold text-texte-dim">{order.customerEmail}</p>
          </section>

          {(order.shippingName || order.shippingLine1) && (
            <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
              <h2 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">{t("shippingAddress")}</h2>
              <div className="mt-3 text-[13px] font-bold text-blanc-casse">
                {order.shippingName && <p>{order.shippingName}</p>}
                {order.shippingLine1 && <p className="text-texte-dim">{order.shippingLine1}</p>}
                {(order.shippingZip || order.shippingCity) && (
                  <p className="text-texte-dim">{[order.shippingZip, order.shippingCity].filter(Boolean).join(" ")}</p>
                )}
                {order.shippingCountry && <p className="text-texte-dim">{order.shippingCountry}</p>}
              </div>
              {order.shippingMethod && (
                <p className="mt-2 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
                  {t("shippingMethod")}: {order.shippingMethod}
                </p>
              )}
              {order.trackingNumber && (
                <p className="mt-2 font-mono text-[12px] text-carmin">{t("trackingNumber")}: {order.trackingNumber}</p>
              )}
            </section>
          )}

          <AdminOrderActions order={order} />
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-bold text-texte-dim">{label}</dt>
      <dd className={`text-right font-extrabold ${highlight ? "text-or" : "text-blanc-casse"} ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
