"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { SecurityExchangeContext } from "@/server/c2c/security.service";
import {
  authorizeCautionAction,
  confirmReceiptAction,
  createExchangeShipmentAction,
  markDeliveredAction,
  markShippedAction,
  openDisputeAction,
} from "@/server/c2c/c2c.actions";
import { ProofVideoList, VideoUploader } from "@/components/security/proof-media";

type PageKey = "garantie" | "option-envoi" | "envoi" | "deballage" | "echange" | "etats" | "litige";

export function SecurityActionsPanel({
  pageKey,
  context,
}: {
  pageKey: PageKey;
  context: SecurityExchangeContext;
}) {
  const t = useTranslations("security.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  const shipment = context.viewerShipment;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "UNKNOWN");
      else router.refresh();
    });
  }

  if (!context) return null;

  return (
    <div className="mt-6 rounded-[12px] border border-charbon-500 bg-charbon-700/50 p-5">
      <p className="text-[10px] font-extrabold tracking-[2px] text-carmin uppercase">{t("panelTitle")}</p>
      <p className="mt-1 text-[12px] font-bold text-texte-dim">
        {t("status")} : <span className="text-blanc-casse">{context.status}</span>
        {shipment?.dropToken && (
          <>
            {" "}
            · {t("token")} : <span className="font-mono text-or">{shipment.dropToken}</span>
          </>
        )}
      </p>

      {pageKey === "echange" && context.status === "ACCEPTED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createExchangeShipmentAction(context.id))}
          className="mt-4 rounded-[11px] bg-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-white uppercase disabled:opacity-50"
        >
          {t("createShipment")}
        </button>
      )}

      {pageKey === "option-envoi" && context.secured && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => authorizeCautionAction(context.id))}
          className="mt-4 rounded-[11px] bg-or px-5 py-2.5 font-display text-[12px] tracking-wide text-charbon uppercase disabled:opacity-50"
        >
          {t("authorizeCaution")}
        </button>
      )}

      {pageKey === "envoi" && shipment?.isShipper && shipment.status === "PENDING" && (
        <div className="mt-4 flex flex-col gap-2">
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder={t("trackingPlaceholder")}
            className="rounded-[11px] border border-charbon-500 bg-charbon px-4 py-2 text-[13px] text-blanc-casse"
          />
          <button
            type="button"
            disabled={pending || tracking.trim().length < 3}
            onClick={() =>
              run(() => markShippedAction({ shipmentId: shipment.id, trackingNumber: tracking.trim() }))
            }
            className="rounded-[11px] bg-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-white uppercase disabled:opacity-50"
          >
            {t("markShipped")}
          </button>
        </div>
      )}

      {/* Upload vidéo PRÉSENTATION (page envoi) */}
      {pageKey === "envoi" && shipment?.isShipper && (
        <>
          <VideoUploader
            shipmentId={shipment.id}
            proofKind="PRESENTATION"
            onDone={() => router.refresh()}
          />
          <ProofVideoList proofs={shipment.proofs.filter((p) => p.kind === "PRESENTATION")} />
        </>
      )}

      {/* Upload vidéo DÉBALLAGE (page déballage) */}
      {pageKey === "deballage" && shipment?.isShipper && (
        <>
          <VideoUploader
            shipmentId={shipment.id}
            proofKind="UNBOXING"
            onDone={() => router.refresh()}
          />
          <ProofVideoList proofs={shipment.proofs.filter((p) => p.kind === "UNBOXING")} />
        </>
      )}

      {pageKey === "garantie" && shipment && !shipment.isShipper && shipment.status === "SHIPPED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => markDeliveredAction(shipment.id))}
          className="mt-4 rounded-[11px] bg-neon-vert/20 px-5 py-2.5 font-display text-[12px] tracking-wide text-neon-vert uppercase disabled:opacity-50"
        >
          {t("markDelivered")}
        </button>
      )}

      {pageKey === "garantie" && ["DELIVERED_WINDOW", "DELIVERED"].includes(context.status) && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => confirmReceiptAction(context.id))}
          className="mt-4 rounded-[11px] bg-neon-vert px-5 py-2.5 font-display text-[12px] tracking-wide text-charbon uppercase disabled:opacity-50"
        >
          {t("confirmReceipt")}
        </button>
      )}

      {pageKey === "litige" && (
        <div className="mt-4 flex flex-col gap-2">
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder={t("disputePlaceholder")}
            rows={3}
            className="rounded-[11px] border border-charbon-500 bg-charbon px-4 py-2 text-[13px] text-blanc-casse"
          />
          <button
            type="button"
            disabled={pending || disputeReason.trim().length < 10}
            onClick={() => run(() => openDisputeAction(context.id, disputeReason.trim()))}
            className="rounded-[11px] bg-neon-rouge/20 px-5 py-2.5 font-display text-[12px] tracking-wide text-neon-rouge uppercase disabled:opacity-50"
          >
            {t("openDispute")}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-[12px] font-bold text-neon-rouge">{t(`errors.${error}`, { default: error })}</p>}
    </div>
  );
}
