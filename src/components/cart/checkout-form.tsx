"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CartSummary } from "@/server/cart/cart.service";
import { startCheckoutAction } from "@/server/checkout/checkout.actions";
import { formatPrice } from "@/lib/format";
import {
  BOUTIQUE_SHIPPING_MODES,
  DEFAULT_BOUTIQUE_SHIPPING_MODE,
  shippingFeeEur,
} from "@/lib/shipping";
import type { ShippingMode } from "@/generated/prisma/client";

interface CheckoutFormProps {
  cart: CartSummary;
  locale: string;
  isAuthenticated: boolean;
  defaultName?: string;
  freeShippingMin: number;
}

export function CheckoutForm({ cart, locale, isAuthenticated, defaultName, freeShippingMin }: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const tMarket = useTranslations("marketplaceCart");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shippingMode, setShippingMode] = useState<ShippingMode>(DEFAULT_BOUTIQUE_SHIPPING_MODE);

  // La franchise « offert dès X€ » reste prioritaire sur le mode choisi.
  const freeShipping = cart.subtotalRaw > 0 && cart.subtotalRaw >= freeShippingMin;
  const shippingRaw = freeShipping ? 0 : shippingFeeEur(shippingMode);
  const totalRaw = cart.subtotalRaw + shippingRaw;

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(`/${locale}/boutique/checkout`);
    return (
      <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-10 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("loginRequired")}</p>
        <a
          href={`/auth/login?returnTo=${returnTo}`}
          className="font-display mt-5 inline-block rounded-[12px] bg-carmin px-6 py-3 text-[14px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt"
        >
          {t("loginCta")}
        </a>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <p className="py-16 text-center text-[14px] font-bold text-texte-dim">
        {t("empty")}{" "}
        <Link href="/panier" className="text-carmin hover:underline">
          {t("backCart")}
        </Link>
      </p>
    );
  }

  const hasStockIssue = cart.lines.some((line) => !line.inStock);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await startCheckoutAction({
        locale,
        fullName: String(form.get("fullName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        address: String(form.get("address") ?? ""),
        zip: String(form.get("zip") ?? ""),
        city: String(form.get("city") ?? ""),
        country: "FR",
        shippingMode,
      });

      if (result.ok) {
        window.location.href = result.url;
        return;
      }

      const errorKey = {
        UNAUTHORIZED: "errorUnauthorized",
        EMPTY_CART: "errorEmptyCart",
        OUT_OF_STOCK: "errorOutOfStock",
        STRIPE_NOT_CONFIGURED: "errorStripeNotConfigured",
        VALIDATION: "errorValidation",
        UNKNOWN: "errorUnknown",
      }[result.error] as "errorUnknown";

      setError(t(errorKey));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("shipping")}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("fullName")}</span>
              <input
                name="fullName"
                required
                className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
                defaultValue={defaultName ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("phone")}</span>
              <input
                name="phone"
                required
                type="tel"
                className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
                placeholder="+33 6 …"
              />
            </label>
            <label className="col-span-full flex flex-col gap-1">
              <span className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("address")}</span>
              <input
                name="address"
                required
                className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("zip")}</span>
              <input
                name="zip"
                required
                className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{t("city")}</span>
              <input
                name="city"
                required
                className="rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
              />
            </label>
          </div>
        </section>

        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{tMarket("shippingTitle")}</h2>
          <div className="mt-4 flex flex-col gap-2.5">
            {BOUTIQUE_SHIPPING_MODES.map((m) => {
              const selected = shippingMode === m.code;
              const feeLabel = freeShipping
                ? tMarket("shippingFree")
                : m.feeEur > 0
                  ? `+ ${formatPrice(m.feeEur)}`
                  : formatPrice(0);
              return (
                <label
                  key={m.code}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${
                    selected ? "border-carmin bg-carmin/8" : "border-charbon-500 bg-charbon-700/40 hover:border-charbon-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="shippingMode"
                    value={m.code}
                    checked={selected}
                    onChange={() => setShippingMode(m.code)}
                    className="accent-carmin"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold text-blanc-casse">{tMarket(`shippingModes.${m.code}`)}</span>
                    <span className="block text-[11px] font-bold text-texte-dim">{tMarket(`shippingModeDesc.${m.code}`)}</span>
                  </span>
                  <span className={`shrink-0 text-[13px] font-extrabold ${freeShipping ? "text-statut-succes" : "text-or"}`}>
                    {feeLabel}
                  </span>
                </label>
              );
            })}
            {freeShipping && (
              <p className="text-[11px] font-bold text-statut-succes">{tMarket("shippingFree")} — {t("shippingLine")}</p>
            )}
          </div>
        </section>

        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("payment")}</h2>
          <div className="mt-4 rounded-[12px] border border-or/30 bg-or/5 p-6 text-center">
            <p className="font-display text-[14px] tracking-wide text-or uppercase">Stripe Checkout</p>
            <p className="mt-2 text-[12px] font-bold text-texte-dim">{t("stripeRedirect")}</p>
          </div>
        </section>
      </div>

      <div className="h-fit rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h3 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("summary")}</h3>
        <ul className="mt-4 flex flex-col gap-2">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex justify-between text-[12px] font-bold text-texte-dim">
              <span className="truncate pr-2">
                {l.name} × {l.quantity}
                {!l.inStock && <span className="ml-1 text-neon-rouge">({t("stockIssue")})</span>}
              </span>
              <span>{l.lineTotal}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between text-[12px] font-bold text-texte-dim">
          <span>{t("shippingLine")}</span>
          <span className={freeShipping ? "text-statut-succes" : undefined}>
            {freeShipping ? tMarket("shippingFree") : formatPrice(shippingRaw)}
          </span>
        </div>
        <div className="mt-4 flex justify-between border-t border-charbon-500 pt-3">
          <span className="font-extrabold text-blanc-casse">{t("total")}</span>
          <span className="font-display text-[20px] text-or">{formatPrice(totalRaw)}</span>
        </div>
        {error && <p className="mt-3 text-center text-[12px] font-bold text-neon-rouge">{error}</p>}
        <button
          type="submit"
          disabled={pending || hasStockIssue}
          className="font-display mt-5 w-full rounded-[12px] bg-or py-3.5 text-[14px] tracking-[1.5px] text-charbon uppercase transition hover:bg-or-clair disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("payProcessing") : t("payCta")}
        </button>
        <p className="mt-3 text-center text-[10px] font-bold text-texte-faible">{t("officialNote")}</p>
      </div>
    </form>
  );
}
