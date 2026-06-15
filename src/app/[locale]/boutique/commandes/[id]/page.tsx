import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAuthViewer } from "@/server/user/user.service";
import { getOrderById } from "@/server/order/order.service";
import { fulfillOrderFromStripeSession } from "@/server/checkout/checkout.service";
import { OrderDetailPanel } from "@/components/order/order-sections";

export const dynamic = "force-dynamic";

export default async function BoutiqueCommandeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ success?: string; session_id?: string }>;
}) {
  const { locale, id } = await params;
  const { success, session_id: sessionId } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("orders");

  const viewer = await requireAuthViewer(`/${locale}/boutique/commandes/${id}`);

  if (sessionId && success === "1") {
    try {
      await fulfillOrderFromStripeSession(sessionId);
    } catch (err) {
      console.error("[order success sync]", err);
    }
  }

  const order = await getOrderById(id, viewer.id);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-[1000px] px-7 pt-9 pb-[60px]">
      {success === "1" && (
        <p className="mb-4 rounded-[12px] border border-neon-vert/30 bg-neon-vert/10 px-4 py-3 text-center text-[13px] font-bold text-neon-vert">
          {t("successPaid")}
        </p>
      )}
      <OrderDetailPanel order={order} />
    </main>
  );
}
