"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { conditionColor } from "@/lib/condition";
import {
  startMarketplaceStripeCheckoutAction,
  payMarketplaceWithWalletAction,
} from "@/server/marketplace-cart/marketplace-cart-checkout.actions";
import type { MarketplaceRecapSummary } from "@/server/marketplace-cart/marketplace-cart-checkout.service";
import { formatPrice } from "@/lib/format";

export function MarketplaceRecapClient({
  recap,
  locale,
  cartItemIds,
  walletBalance,
}: {
  recap: MarketplaceRecapSummary;
  locale: string;
  cartItemIds?: string[];
  walletBalance: number;
}) {
  const t = useTranslations("marketplaceCart");
  const tCond = useTranslations("conditions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canPayWithWallet = walletBalance >= recap.subtotalRaw;

  function handlePayWithWallet() {
    setError(null);
    startTransition(async () => {
      const result = await payMarketplaceWithWalletAction({ locale, cartItemIds });
      if (result.ok) {
        router.push(`/marketplace/panier/confirmation/${result.checkoutId}?success=1`);
      } else {
        setError(result.error);
      }
    });
  }

  function handlePayWithStripe() {
    setError(null);
    startTransition(async () => {
      const result = await startMarketplaceStripeCheckoutAction({ locale, cartItemIds });
      if (result.ok) {
        window.location.href = result.url;
      } else {
        setError(result.error);
      }
    });
  }

  if (recap.lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
        <Link href="/marketplace/panier" className="mt-4 inline-block text-carmin hover:underline">
          {t("backCart")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        {recap.lines.map((line) => (
          <div key={line.id} className="flex gap-4 rounded-[16px] border border-charbon-500 bg-charbon-800 p-4">
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-[10px] bg-charbon-700">
              {line.image && (
                <Image src={line.image} alt={line.name} fill className="object-cover" sizes="56px" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-extrabold text-blanc-casse">{line.name}</div>
              <p className="text-[11px] font-bold text-texte-dim">
                {line.versionLabel}
                {" · "}
                <span style={{ color: conditionColor(line.conditionCode) }}>{tCond(line.conditionCode)}</span>
              </p>
              <p className="text-[11px] font-bold text-texte-faible">{line.sellerName}</p>
            </div>
            <p className="font-display shrink-0 text-[18px] text-blanc-casse">{line.priceLabel}</p>
          </div>
        ))}
      </div>

      <div className="h-fit rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h3 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("recapTitle")}</h3>
        <p className="mt-2 text-[11px] font-bold text-texte-faible">
          {canPayWithWallet ? t("walletHint") : t("stripeHint")}
        </p>
        <div className="mt-4 flex flex-col gap-2 text-[13px] font-bold">
          <div className="flex justify-between text-texte-dim">
            <span>{t("subtotal")}</span>
            <span>{recap.subtotal}</span>
          </div>
          {canPayWithWallet && (
            <div className="flex justify-between text-texte-dim">
              <span>{t("walletBalance")}</span>
              <span className="text-neon-vert">{formatPrice(walletBalance)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-charbon-500 pt-3 text-blanc-casse">
            <span className="font-extrabold">{t("total")}</span>
            <span className="font-display text-[20px] text-carmin">{recap.subtotal}</span>
          </div>
        </div>

        {canPayWithWallet ? (
          <>
            <button
              type="button"
              onClick={handlePayWithWallet}
              disabled={pending}
              className="font-display mt-5 flex w-full items-center justify-center rounded-[12px] bg-statut-succes py-3.5 text-[14px] tracking-[1.5px] text-charbon uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t("processingWallet") : t("payWithWallet", { amount: formatPrice(recap.subtotalRaw) })}
            </button>
            <button
              type="button"
              onClick={handlePayWithStripe}
              disabled={pending}
              className="font-display mt-3 flex w-full items-center justify-center rounded-[12px] border border-charbon-500 py-3 text-[12px] tracking-[1px] text-texte-dim uppercase transition hover:text-blanc-casse disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("payWithStripe")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handlePayWithStripe}
            disabled={pending}
            className="font-display mt-5 flex w-full items-center justify-center rounded-[12px] bg-carmin py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("redirectingStripe") : t("payWithStripe")}
          </button>
        )}

        {error && (
          <p className="mt-3 text-center text-[11px] font-bold text-neon-rouge">
            {t(`checkoutError.${error}`)}
          </p>
        )}
        <Link
          href="/marketplace/panier"
          className="mt-4 block text-center text-[11px] font-bold text-texte-faible hover:text-carmin"
        >
          ← {t("backCart")}
        </Link>
      </div>
    </div>
  );
}
