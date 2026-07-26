"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { ShippingMode } from "@/generated/prisma/client";
import type { UserAddress } from "@/server/user/address.service";
import { registerForAuctionAction } from "@/server/auction/auction.actions";

export interface AuctionShippingChoice {
  code: ShippingMode;
  feeEur: number;
}

/**
 * Inscription à une enchère : le participant déclare où et comment il se ferait
 * livrer s'il l'emporte. Tant que ce n'est pas fait, `placeBid` refuse ses mises —
 * l'adjudication doit produire une vente expédiable sans rien lui redemander.
 */
export function AuctionRegistrationForm({
  auctionId,
  addresses,
  shippingModes,
  current,
}: {
  auctionId: string;
  addresses: UserAddress[];
  shippingModes: AuctionShippingChoice[];
  /** Inscription déjà enregistrée, `null` si le membre ne s'est pas encore inscrit. */
  current: { addressId: string | null; shippingMode: ShippingMode } | null;
}) {
  const t = useTranslations("auctions");
  const tCart = useTranslations("marketplaceCart");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(current == null);

  const [mode, setMode] = useState<ShippingMode>(current?.shippingMode ?? shippingModes[0]?.code);
  const [addressId, setAddressId] = useState<string>(
    current?.addressId ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "",
  );

  const eur = (v: number) => format.number(v, { style: "currency", currency: "EUR" });
  const handDelivery = mode === "HAND_DELIVERY";
  const chosenFee = shippingModes.find((m) => m.code === mode)?.feeEur ?? 0;

  function errorMessage(code: string): string {
    switch (code) {
      case "ADDRESS_REQUIRED":
        return t("registerErrorAddressRequired");
      case "ADDRESS_NOT_FOUND":
        return t("registerErrorAddressNotFound");
      case "SELF_BID":
        return t("errorSelfBid");
      case "AUCTION_NOT_FOUND":
        return t("errorEnded");
      default:
        return t("errorGeneric");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const res = await registerForAuctionAction({
        auctionId,
        // La remise en main propre n'a pas d'adresse : le serveur la refuse.
        addressId: handDelivery ? null : addressId || null,
        shippingMode: mode,
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    });
  }

  // Sans adresse enregistrée et hors remise en main propre, on ne peut rien valider.
  const needsAddress = !handDelivery && addresses.length === 0;

  if (!editing && current) {
    const addr = addresses.find((a) => a.id === current.addressId);
    return (
      <div className="border-charbon-500 bg-charbon-800/60 mt-4 rounded-[12px] border p-3.5">
        <p className="text-neon-vert text-[12.5px] font-extrabold">{t("registerDone")}</p>
        <p className="text-texte-faible mt-1 text-[11.5px] font-bold">
          {tCart(`shippingModes.${current.shippingMode}`)}
          {addr ? ` · ${addr.fullName}, ${addr.zip} ${addr.city}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-or mt-2 text-[11px] font-extrabold uppercase hover:underline"
        >
          {t("registerEdit")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-or/30 bg-charbon-800/60 mt-4 rounded-[12px] border p-3.5"
    >
      <p className="text-or text-[12.5px] font-extrabold">{t("registerTitle")}</p>
      <p className="text-texte-faible mt-1 text-[11.5px] leading-relaxed font-bold">
        {t("registerPitch")}
      </p>

      <fieldset className="mt-3">
        <legend className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
          {t("registerShippingLabel")}
        </legend>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {shippingModes.map((m) => (
            <label
              key={m.code}
              className="text-texte-doux flex items-center gap-2.5 text-[12.5px] font-bold"
            >
              <input
                type="radio"
                name="shippingMode"
                value={m.code}
                checked={mode === m.code}
                onChange={() => setMode(m.code)}
                className="accent-carmin"
              />
              <span>{tCart(`shippingModes.${m.code}`)}</span>
              <span className="text-or font-mono text-[11.5px]">
                {m.feeEur > 0 ? eur(m.feeEur) : t("registerShippingFree")}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!handDelivery && (
        <div className="mt-3">
          <label
            htmlFor="auction-address"
            className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase"
          >
            {t("registerAddressLabel")}
          </label>
          {needsAddress ? (
            <p className="mt-1.5 text-[11.5px] font-bold">
              <Link href="/parametres" className="text-carmin hover:underline">
                {t("registerAddAddress")}
              </Link>
            </p>
          ) : (
            <select
              id="auction-address"
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
              className="border-charbon-500 bg-charbon-700 text-blanc-casse focus:border-carmin mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id} className="bg-charbon-800">
                  {a.label ? `${a.label} — ` : ""}
                  {a.fullName}, {a.line1}, {a.zip} {a.city}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <p className="text-texte-faible mt-3 text-[11px] font-bold">
        {t("registerTotalHint", { fee: chosenFee > 0 ? eur(chosenFee) : eur(0) })}
      </p>

      {error && <p className="text-neon-rouge mt-2 text-[12px] font-bold">{error}</p>}
      {saved && <p className="text-neon-vert mt-2 text-[12px] font-bold">{t("registerSaved")}</p>}

      <button
        type="submit"
        disabled={pending || needsAddress}
        className="bg-carmin font-display mt-3 rounded-[11px] px-5 py-2.5 text-[12px] tracking-[1px] text-white uppercase disabled:opacity-50"
      >
        {t("registerSubmit")}
      </button>
    </form>
  );
}
