"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations, useFormatter } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createSaleShipmentAction,
  markSaleShippedAction,
  markSaleDeliveredAction,
  confirmSaleReceiptAction,
  openSaleDisputeAction,
} from "@/server/sale/sale-tracking.actions";
import { ProofVideoList, VideoUploader } from "@/components/security/proof-media";

const CARRIERS = ["COLISSIMO", "LAPOSTE", "CHRONOPOST", "MONDIAL_RELAY", "OTHER"] as const;

export interface SaleTrackingView {
  saleId: string;
  status: string;
  shippingMode: string;
  handDelivery: boolean;
  priceLabel: string;
  shippingCostLabel: string | null;
  totalLabel: string;
  isBuyer: boolean;
  card: { name: string; image: string | null; versionLabel: string };
  counterpart: { name: string; slug: string };
  conversationId: string | null;
  deliveryAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    zip: string;
    city: string;
    country: string;
    phone?: string | null;
  } | null;
  shipment: {
    id: string;
    status: string;
    trackingNumber: string | null;
    carrier: string | null;
    dropToken: string | null;
    notShipDeadline: string | null;
    guaranteeEndsAt: string | null;
    proofs: { id: string; kind: string; mediaUrl: string }[];
  } | null;
  disputeOpen: boolean;
}

/** Étapes de la timeline (COMPLETED = validé ; états d'échec affichés à part). */
const STEPS = ["PAID", "AWAITING_SHIPMENT", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

function stepIndex(status: string): number {
  switch (status) {
    case "PAID":
      return 0;
    case "AWAITING_SHIPMENT":
      return 1;
    case "SHIPPED":
      return 2;
    case "DELIVERED_WINDOW":
    case "DELIVERED":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return -1; // litige / annulée
  }
}

function Timeline({ status }: { status: string }) {
  const t = useTranslations("saleTracking");
  const current = stepIndex(status);

  return (
    <div className="mt-5 flex items-start">
      {STEPS.map((step, i) => (
        <div key={step} className="flex flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            <div className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= current ? "bg-carmin" : "bg-charbon-500"}`} />
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                i < current
                  ? "bg-carmin text-white"
                  : i === current
                    ? "border-2 border-carmin bg-carmin/15 text-carmin"
                    : "border border-charbon-500 bg-charbon-800 text-texte-faible"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <div className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? "bg-transparent" : i < current ? "bg-carmin" : "bg-charbon-500"}`} />
          </div>
          <p className={`mt-1.5 px-1 text-center text-[9.5px] font-extrabold tracking-wide uppercase ${i <= current ? "text-blanc-casse" : "text-texte-faible"}`}>
            {t(`steps.${step}`)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  onClick,
  pending,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  pending: boolean;
  children: React.ReactNode;
  variant?: "primary" | "success" | "ghost";
}) {
  const styles = {
    primary: "bg-carmin text-white hover:bg-carmin-alt",
    success: "bg-statut-succes text-charbon hover:opacity-90",
    ghost: "border border-charbon-400 text-texte-doux hover:border-carmin hover:text-carmin",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`font-display -skew-x-3 rounded-[11px] px-5 py-2.5 text-[12px] tracking-[1px] uppercase transition disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function SaleTrackingPanel({ view }: { view: SaleTrackingView }) {
  const t = useTranslations("saleTracking");
  const tCart = useTranslations("marketplaceCart");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState<(typeof CARRIERS)[number]>("COLISSIMO");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const isSeller = !view.isBuyer;
  const s = view.status;
  const shipment = view.shipment;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "UNKNOWN");
      else router.refresh();
    });
  }

  const guaranteeEndsAt = shipment?.guaranteeEndsAt ? new Date(shipment.guaranteeEndsAt) : null;
  const notShipDeadline = shipment?.notShipDeadline ? new Date(shipment.notShipDeadline) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
        {/* En-tête vente */}
        <div className="flex gap-4">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[10px] bg-charbon-700">
            {view.card.image && <Image src={view.card.image} alt={view.card.name} fill className="object-cover" sizes="80px" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] tracking-wide uppercase text-blanc-casse">{view.card.name}</h2>
            <p className="text-[12px] font-bold text-texte-dim">
              {view.card.versionLabel} · {view.isBuyer ? t("soldBy") : t("soldTo")}{" "}
              <Link href={`/collectionneur/${view.counterpart.slug}`} className="text-carmin hover:underline">
                {view.counterpart.name}
              </Link>
            </p>
            <p className="mt-2 text-[12px] font-bold text-texte-dim">
              {view.priceLabel}
              {view.shippingCostLabel && <> + {view.shippingCostLabel} {t("shippingSuffix")}</>}
              {" · "}
              <span className="font-display text-[15px] text-or">{view.totalLabel}</span>
            </p>
            <span className="mt-1.5 inline-block rounded bg-charbon-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-texte-doux uppercase">
              {tCart(`shippingModes.${view.shippingMode}`)}
            </span>
          </div>
        </div>

        {/* Timeline ou état d'exception */}
        {stepIndex(s) >= 0 ? (
          <Timeline status={s} />
        ) : (
          <p className="mt-5 rounded-[10px] border border-neon-rouge/40 bg-neon-rouge/8 p-3 text-[12.5px] font-extrabold text-neon-rouge">
            {t(`exception.${s === "DISPUTED" ? "DISPUTED" : "CANCELLED"}`)}
          </p>
        )}

        {/* ── Étape en cours ─────────────────────────────────────────────── */}
        <div className="mt-6 rounded-[12px] border border-charbon-500 bg-charbon-700/40 p-4">
          {/* Vendeur */}
          {isSeller && s === "PAID" && !view.handDelivery && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("seller.paidTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("seller.paidBody")}</p>
              <div className="mt-3">
                <ActionButton pending={pending} onClick={() => run(() => createSaleShipmentAction(view.saleId))}>
                  {t("seller.openShipment")}
                </ActionButton>
              </div>
            </>
          )}
          {isSeller && s === "PAID" && view.handDelivery && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("seller.handTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("seller.handBody")}</p>
            </>
          )}
          {isSeller && s === "AWAITING_SHIPMENT" && shipment && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("seller.awaitingTitle")}</p>
              {notShipDeadline && (
                <p className="mt-1 text-[11.5px] font-bold text-neon-orange">
                  {t("seller.deadline", { date: format.dateTime(notShipDeadline, { dateStyle: "medium" }) })}
                </p>
              )}
              {shipment.dropToken && (
                <p className="mt-2 text-[12px] font-bold text-texte-dim">
                  {t("seller.dropToken")}{" "}
                  <span className="rounded bg-charbon-900 px-2 py-0.5 font-mono text-[12px] text-or">{shipment.dropToken}</span>
                </p>
              )}
              <VideoUploader shipmentId={shipment.id} proofKind="PRESENTATION" onDone={() => router.refresh()} />
              <div className="mt-4 border-t border-charbon-500 pt-4">
                <p className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("seller.shipTitle")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value as (typeof CARRIERS)[number])}
                    className="rounded-[10px] border border-charbon-500 bg-charbon-800 px-3 py-2.5 text-[12px] font-bold text-blanc-casse outline-none focus:border-carmin"
                  >
                    {CARRIERS.map((c) => (
                      <option key={c} value={c}>
                        {t(`carriers.${c}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder={t("seller.trackingPlaceholder")}
                    className="min-w-[180px] flex-1 rounded-[10px] border border-charbon-500 bg-charbon-800 px-3 py-2.5 text-[12px] font-bold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-carmin"
                  />
                  <ActionButton
                    pending={pending}
                    onClick={() =>
                      run(() => markSaleShippedAction({ shipmentId: shipment.id, trackingNumber, carrier }))
                    }
                  >
                    {t("seller.markShipped")}
                  </ActionButton>
                </div>
              </div>
            </>
          )}
          {isSeller && (s === "SHIPPED" || s === "DELIVERED_WINDOW" || s === "DELIVERED") && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("seller.shippedTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("seller.shippedBody")}</p>
            </>
          )}
          {isSeller && s === "COMPLETED" && (
            <>
              <p className="text-[13px] font-extrabold text-statut-succes">✓ {t("seller.completedTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("seller.completedBody")}</p>
              <Link href="/portefeuille" className="mt-2 inline-block text-[12px] font-extrabold text-carmin hover:underline">
                {t("seller.viewWallet")} →
              </Link>
            </>
          )}

          {/* Acheteur */}
          {view.isBuyer && (s === "PAID" || s === "AWAITING_SHIPMENT") && !view.handDelivery && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("buyer.waitingTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("buyer.waitingBody")}</p>
            </>
          )}
          {view.isBuyer && (s === "PAID" || s === "AWAITING_SHIPMENT") && view.handDelivery && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("buyer.handTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("buyer.handBody")}</p>
              <div className="mt-3">
                <ActionButton variant="success" pending={pending} onClick={() => run(() => confirmSaleReceiptAction(view.saleId))}>
                  {t("buyer.confirmReceipt")}
                </ActionButton>
              </div>
            </>
          )}
          {view.isBuyer && s === "SHIPPED" && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("buyer.shippedTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("buyer.shippedBody")}</p>
              <div className="mt-3">
                <ActionButton pending={pending} onClick={() => run(() => markSaleDeliveredAction(view.saleId))}>
                  {t("buyer.markDelivered")}
                </ActionButton>
              </div>
            </>
          )}
          {view.isBuyer && (s === "DELIVERED_WINDOW" || s === "DELIVERED") && shipment && (
            <>
              <p className="text-[13px] font-extrabold text-blanc-casse">{t("buyer.deliveredTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("buyer.deliveredBody")}</p>
              {guaranteeEndsAt && (
                <p className="mt-1 text-[11.5px] font-bold text-neon-orange">
                  {t("buyer.guaranteeUntil", {
                    date: format.dateTime(guaranteeEndsAt, { dateStyle: "medium", timeStyle: "short" }),
                  })}
                </p>
              )}
              <VideoUploader shipmentId={shipment.id} proofKind="UNBOXING" onDone={() => router.refresh()} />
              <div className="mt-3">
                <ActionButton variant="success" pending={pending} onClick={() => run(() => confirmSaleReceiptAction(view.saleId))}>
                  {t("buyer.confirmReceipt")}
                </ActionButton>
              </div>
            </>
          )}
          {view.isBuyer && s === "COMPLETED" && (
            <>
              <p className="text-[13px] font-extrabold text-statut-succes">✓ {t("buyer.completedTitle")}</p>
              <p className="mt-1 text-[12px] font-bold text-texte-dim">{t("buyer.completedBody")}</p>
            </>
          )}

          {error && <p className="mt-3 text-[11.5px] font-bold text-neon-rouge">{t(`errors.${error}` as never) ?? error}</p>}
        </div>

        {/* Suivi transporteur */}
        {shipment?.trackingNumber && (
          <div className="mt-4 rounded-[12px] border border-charbon-500 bg-charbon-700/40 p-4">
            <p className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("trackingTitle")}</p>
            <p className="mt-1.5 text-[13px] font-extrabold text-blanc-casse">
              {shipment.carrier ? t(`carriers.${shipment.carrier}` as never) : "—"} ·{" "}
              <span className="font-mono text-or">{shipment.trackingNumber}</span>
            </p>
          </div>
        )}

        {/* Preuves vidéo */}
        {shipment && <ProofVideoList proofs={shipment.proofs} />}
      </div>

      {/* Colonne latérale */}
      <div className="flex h-fit flex-col gap-4">
        {/* Adresse (vendeur : où expédier · acheteur : rappel) */}
        {view.deliveryAddress && (
          <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
            <p className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
              {isSeller ? t("addressSellerTitle") : t("addressBuyerTitle")}
            </p>
            <div className="mt-2 text-[12.5px] font-bold text-texte-doux">
              <p className="text-blanc-casse">{view.deliveryAddress.fullName}</p>
              <p>{view.deliveryAddress.line1}</p>
              {view.deliveryAddress.line2 && <p>{view.deliveryAddress.line2}</p>}
              <p>
                {view.deliveryAddress.zip} {view.deliveryAddress.city}
                {view.deliveryAddress.country !== "FR" ? ` · ${view.deliveryAddress.country}` : ""}
              </p>
              {view.deliveryAddress.phone && <p className="text-texte-faible">{view.deliveryAddress.phone}</p>}
            </div>
            {isSeller && (
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 w-full rounded-[10px] border border-charbon-400 px-4 py-2 font-display text-[11px] tracking-[1px] text-texte-doux uppercase transition hover:border-carmin hover:text-carmin"
              >
                🖨 {t("printSlip")}
              </button>
            )}
          </div>
        )}

        {/* Chat lié à la vente */}
        {view.conversationId && (
          <Link
            href={`/messages/${view.conversationId}`}
            className="font-display -skew-x-3 rounded-[12px] border-[1.5px] border-carmin bg-carmin/10 px-5 py-3 text-center text-[12.5px] tracking-[1.5px] text-carmin uppercase transition hover:bg-carmin hover:text-white"
          >
            💬 {view.isBuyer ? t("contactSeller") : t("contactBuyer")}
          </Link>
        )}

        {/* Litige */}
        {["SHIPPED", "DELIVERED_WINDOW", "DELIVERED"].includes(s) && !view.disputeOpen && (
          <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
            {!showDispute ? (
              <button
                type="button"
                onClick={() => setShowDispute(true)}
                className="w-full text-[11.5px] font-extrabold text-texte-faible transition hover:text-neon-rouge"
              >
                ⚠ {t("dispute.open")}
              </button>
            ) : (
              <>
                <p className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("dispute.title")}</p>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder={t("dispute.placeholder")}
                  rows={3}
                  className="mt-2 w-full rounded-[10px] border border-charbon-500 bg-charbon-900 px-3 py-2 text-[12px] font-semibold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-neon-rouge"
                />
                <button
                  type="button"
                  disabled={pending || disputeReason.trim().length < 10}
                  onClick={() => run(() => openSaleDisputeAction(view.saleId, disputeReason))}
                  className="mt-2 w-full rounded-[10px] bg-neon-rouge/15 px-4 py-2.5 font-display text-[11.5px] tracking-[1px] text-neon-rouge uppercase transition hover:bg-neon-rouge/25 disabled:opacity-40"
                >
                  {t("dispute.submit")}
                </button>
              </>
            )}
          </div>
        )}
        {view.disputeOpen && (
          <p className="rounded-[12px] border border-neon-rouge/40 bg-neon-rouge/8 p-3 text-center text-[12px] font-extrabold text-neon-rouge">
            {t("dispute.pending")}
          </p>
        )}
      </div>
    </div>
  );
}
