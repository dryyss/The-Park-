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
import type { UserAddress } from "@/server/user/address.service";
import { formatPrice } from "@/lib/format";

type AddressMode = "existing" | "new";

interface NewAddressFields {
  fullName: string;
  line1: string;
  line2: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
}

function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  mode,
  onModeChange,
  newFields,
  onNewField,
}: {
  addresses: UserAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: AddressMode;
  onModeChange: (m: AddressMode) => void;
  newFields: NewAddressFields;
  onNewField: (k: keyof NewAddressFields, v: string) => void;
}) {
  const t = useTranslations("marketplaceCart");

  return (
    <div className="mt-5 rounded-[14px] border border-charbon-500 bg-charbon-700/40 p-4">
      <p className="mb-3 text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
        {t("addressTitle")}
      </p>

      {addresses.length > 0 && (
        <div className="flex flex-col gap-2">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition ${
                mode === "existing" && selectedId === addr.id
                  ? "border-carmin bg-carmin/10"
                  : "border-charbon-500 hover:border-charbon-400"
              }`}
            >
              <input
                type="radio"
                name="address"
                value={addr.id}
                checked={mode === "existing" && selectedId === addr.id}
                onChange={() => { onModeChange("existing"); onSelect(addr.id); }}
                className="mt-0.5 accent-carmin"
              />
              <div className="min-w-0 flex-1 text-[12px]">
                {addr.label && (
                  <span className="mb-0.5 block text-[10px] font-extrabold tracking-wide text-texte-faible uppercase">
                    {addr.label}
                  </span>
                )}
                <span className="font-extrabold text-blanc-casse">{addr.fullName}</span>
                <span className="mt-0.5 block font-semibold text-texte-dim">
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ""}
                </span>
                <span className="block font-semibold text-texte-dim">
                  {addr.zip} {addr.city}
                  {addr.country !== "FR" ? ` · ${addr.country}` : ""}
                </span>
                {addr.phone && (
                  <span className="block text-[11px] text-texte-faible">{addr.phone}</span>
                )}
              </div>
            </label>
          ))}

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 transition ${
              mode === "new" ? "border-carmin bg-carmin/10" : "border-charbon-500 hover:border-charbon-400"
            }`}
          >
            <input
              type="radio"
              name="address"
              value="new"
              checked={mode === "new"}
              onChange={() => onModeChange("new")}
              className="accent-carmin"
            />
            <span className="text-[12px] font-bold text-texte-doux">
              + {t("addressNewLabel")}
            </span>
          </label>
        </div>
      )}

      {(mode === "new" || addresses.length === 0) && (
        <div className={`flex flex-col gap-2 ${addresses.length > 0 ? "mt-3" : ""}`}>
          {addresses.length === 0 && (
            <p className="mb-1 text-[11px] font-semibold text-texte-faible">{t("addressNoSaved")}</p>
          )}
          <input
            type="text"
            placeholder={t("addressFullName")}
            value={newFields.fullName}
            onChange={(e) => onNewField("fullName", e.target.value)}
            className="w-full rounded-[9px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
          />
          <input
            type="text"
            placeholder={t("addressLine1")}
            value={newFields.line1}
            onChange={(e) => onNewField("line1", e.target.value)}
            className="w-full rounded-[9px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
          />
          <input
            type="text"
            placeholder={t("addressLine2")}
            value={newFields.line2}
            onChange={(e) => onNewField("line2", e.target.value)}
            className="w-full rounded-[9px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("addressZip")}
              value={newFields.zip}
              onChange={(e) => onNewField("zip", e.target.value)}
              className="w-[90px] rounded-[9px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
            />
            <input
              type="text"
              placeholder={t("addressCity")}
              value={newFields.city}
              onChange={(e) => onNewField("city", e.target.value)}
              className="flex-1 rounded-[9px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
            />
          </div>
          <input
            type="tel"
            placeholder={t("addressPhone")}
            value={newFields.phone}
            onChange={(e) => onNewField("phone", e.target.value)}
            className="w-full rounded-[9px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
          />
        </div>
      )}
    </div>
  );
}

export function MarketplaceRecapClient({
  recap,
  locale,
  cartItemIds,
  walletBalance,
  addresses,
}: {
  recap: MarketplaceRecapSummary;
  locale: string;
  cartItemIds?: string[];
  walletBalance: number;
  addresses: UserAddress[];
}) {
  const t = useTranslations("marketplaceCart");
  const tCond = useTranslations("conditions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stripeFeesAccepted, setStripeFeesAccepted] = useState(false);

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressMode, setAddressMode] = useState<AddressMode>(
    addresses.length > 0 ? "existing" : "new"
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultAddress?.id ?? null
  );
  const [newAddress, setNewAddress] = useState<NewAddressFields>({
    fullName: "", line1: "", line2: "", zip: "", city: "", country: "FR", phone: "",
  });

  function setNewField(k: keyof NewAddressFields, v: string) {
    setNewAddress((prev) => ({ ...prev, [k]: v }));
  }

  const newAddressValid =
    newAddress.fullName.trim().length > 0 &&
    newAddress.line1.trim().length > 0 &&
    newAddress.zip.trim().length > 0 &&
    newAddress.city.trim().length > 0;

  const addressReady =
    addressMode === "existing" ? !!selectedAddressId : newAddressValid;

  const canPayWithWallet = walletBalance >= recap.subtotalRaw;
  const hasPartialWallet = walletBalance > 0 && walletBalance < recap.subtotalRaw;

  const stripeFeeRaw = Math.round(recap.subtotalRaw * 0.05 * 100) / 100;
  const stripeTotalRaw = recap.subtotalRaw + stripeFeeRaw;

  function handlePayWithWallet() {
    setError(null);
    startTransition(async () => {
      const addressPayload =
        addressMode === "existing" && selectedAddressId
          ? { addressId: selectedAddressId }
          : {
              newAddress: {
                fullName: newAddress.fullName,
                line1: newAddress.line1,
                line2: newAddress.line2 || undefined,
                zip: newAddress.zip,
                city: newAddress.city,
                country: newAddress.country || "FR",
                phone: newAddress.phone || undefined,
              },
            };

      const result = await payMarketplaceWithWalletAction({
        locale,
        cartItemIds,
        ...addressPayload,
      });
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
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
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
              <p className="mt-1 text-[10.5px] font-bold text-texte-faible">
                {line.shippingMode === "SECURED" ? (
                  <span className="text-neon-vert">✓ {t("shippingSecured")}</span>
                ) : (
                  <span>{t("shippingStandard")}</span>
                )}
              </p>
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
          {(canPayWithWallet || hasPartialWallet) && (
            <div className="flex justify-between text-texte-dim">
              <span>{t("walletBalance")}</span>
              <span className={canPayWithWallet ? "text-neon-vert" : "text-neon-orange"}>{formatPrice(walletBalance)}</span>
            </div>
          )}
          {hasPartialWallet && (
            <div className="flex justify-between text-texte-faible text-[11px]">
              <span>{t("walletShortfall")}</span>
              <span>{formatPrice(recap.subtotalRaw - walletBalance)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-charbon-500 pt-3 text-blanc-casse">
            <span className="font-extrabold">{t("total")}</span>
            <span className="font-display text-[20px] text-carmin">{recap.subtotal}</span>
          </div>
        </div>

        {/* Adresse de livraison — requise pour paiement portefeuille */}
        <AddressPicker
          addresses={addresses}
          selectedId={selectedAddressId}
          onSelect={setSelectedAddressId}
          mode={addressMode}
          onModeChange={setAddressMode}
          newFields={newAddress}
          onNewField={setNewField}
        />

        {canPayWithWallet ? (
          <>
            <button
              type="button"
              onClick={handlePayWithWallet}
              disabled={pending || !addressReady}
              className="font-display mt-4 flex w-full items-center justify-center rounded-[12px] bg-statut-succes py-3.5 text-[14px] tracking-[1.5px] text-charbon uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t("processingWallet") : t("payWithWallet", { amount: formatPrice(recap.subtotalRaw) })}
            </button>
            {!addressReady && (
              <p className="mt-1 text-center text-[10.5px] font-semibold text-texte-faible">
                {t("addressRequired")}
              </p>
            )}

            {/* Stripe optionnel — frais 5% */}
            <div className="mt-4 rounded-lg border border-charbon-600 bg-charbon-700/40 px-3 py-3">
              <div className="flex items-center justify-between text-[11.5px] font-bold text-texte-dim">
                <span>{t("stripeFeeLabel")}</span>
                <span className="text-neon-orange">+{formatPrice(stripeFeeRaw)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px] font-extrabold text-blanc-casse">
                <span>{t("stripeTotalLabel")}</span>
                <span>{formatPrice(stripeTotalRaw)}</span>
              </div>
              <label className="mt-2.5 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={stripeFeesAccepted}
                  onChange={(e) => setStripeFeesAccepted(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-carmin"
                />
                <span className="text-[10.5px] font-semibold leading-snug text-texte-dim">
                  {t("stripeFeeConsent", { fee: formatPrice(stripeFeeRaw) })}
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={handlePayWithStripe}
              disabled={pending || !stripeFeesAccepted}
              className="font-display mt-2 flex w-full items-center justify-center rounded-[12px] border border-charbon-500 py-3 text-[12px] tracking-[1px] text-texte-dim uppercase transition hover:text-blanc-casse disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("payWithStripe")}
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-lg border border-charbon-600 bg-charbon-700/40 px-3 py-3">
              <div className="flex items-center justify-between text-[11.5px] font-bold text-texte-dim">
                <span>{t("stripeFeeLabel")}</span>
                <span className="text-neon-orange">+{formatPrice(stripeFeeRaw)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px] font-extrabold text-blanc-casse">
                <span>{t("stripeTotalLabel")}</span>
                <span>{formatPrice(stripeTotalRaw)}</span>
              </div>
              <label className="mt-2.5 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={stripeFeesAccepted}
                  onChange={(e) => setStripeFeesAccepted(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-carmin"
                />
                <span className="text-[10.5px] font-semibold leading-snug text-texte-dim">
                  {t("stripeFeeConsent", { fee: formatPrice(stripeFeeRaw) })}
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={handlePayWithStripe}
              disabled={pending || !stripeFeesAccepted}
              className="font-display mt-2 flex w-full items-center justify-center rounded-[12px] bg-carmin py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t("redirectingStripe") : t("payWithStripe")}
            </button>
          </>
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
