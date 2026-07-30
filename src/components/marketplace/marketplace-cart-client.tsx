"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { conditionColor } from "@/lib/condition";
import { Link } from "@/i18n/navigation";
import { MarketplaceCartRemoveButton } from "@/components/marketplace/marketplace-cart-controls";
import { renewMarketplaceCartAction } from "@/server/marketplace-cart/marketplace-cart.actions";
import type { MarketplaceCartSummary } from "@/server/marketplace-cart/marketplace-cart.service";

export function MarketplaceCartClient({
  cart,
  locale,
}: {
  cart: MarketplaceCartSummary;
  locale: string;
}) {
  const t = useTranslations("marketplaceCart");
  const tCond = useTranslations("conditions");
  const router = useRouter();
  const [renewing, startRenew] = useTransition();

  // Seules les lignes encore réservées sont sélectionnables : une réservation
  // expirée doit d'abord être relancée.
  const payableLines = useMemo(() => cart.lines.filter((l) => !l.expired), [cart.lines]);

  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});

  const selectedLines = useMemo(
    () => payableLines.filter((l) => !unchecked[l.id]),
    [payableLines, unchecked],
  );

  const selectedTotal = useMemo(
    () => selectedLines.reduce((s, l) => s + l.priceRaw, 0),
    [selectedLines],
  );

  const selectedTotalLabel = selectedTotal.toFixed(2).replace(".", ",") + " €";

  function toggle(id: string) {
    setUnchecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll(value: boolean) {
    setUnchecked(value ? {} : Object.fromEntries(payableLines.map((l) => [l.id, true])));
  }

  function renewExpired() {
    startRenew(async () => {
      await renewMarketplaceCartAction();
      router.refresh();
    });
  }

  function goToRecap() {
    if (selectedLines.length === 0) return;
    const excludedIds = payableLines.filter((l) => unchecked[l.id]).map((l) => l.id);
    // On envoie la plus courte des deux listes : sur un très gros panier,
    // énumérer toutes les lignes retenues dépassait la taille d'URL admise.
    const query =
      excludedIds.length === 0
        ? "items=all"
        : excludedIds.length < selectedLines.length
          ? `exclude=${encodeURIComponent(excludedIds.join(","))}`
          : `items=${encodeURIComponent(selectedLines.map((l) => l.id).join(","))}`;
    router.push(`/marketplace/panier/recap?${query}`);
  }

  if (cart.lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
        <Link
          href="/marketplace"
          className="mt-4 inline-block font-display text-[14px] tracking-wide text-carmin uppercase hover:underline"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="page-focus mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        {cart.expiredCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-neon-rouge/40 bg-neon-rouge/8 px-4 py-3">
            <p className="min-w-0 flex-1 text-[12px] font-bold text-texte-doux">
              {t("expiredNotice", { count: cart.expiredCount })}
            </p>
            <button
              type="button"
              onClick={renewExpired}
              disabled={renewing}
              className="font-display rounded-lg border border-neon-rouge/60 px-3.5 py-2 text-[11px] tracking-[1px] text-neon-rouge uppercase transition-colors hover:bg-neon-rouge/15 disabled:opacity-60"
            >
              {renewing ? t("renewPending") : t("renewExpired")}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("selectItems")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="text-[10px] font-extrabold text-carmin uppercase hover:underline"
            >
              {t("selectAll")}
            </button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="text-[10px] font-extrabold text-texte-faible uppercase hover:underline"
            >
              {t("selectNone")}
            </button>
          </div>
        </div>

        {cart.lines.map((line) => {
          const checked = !line.expired && !unchecked[line.id];
          return (
            <label
              key={line.id}
              className={[
                "flex gap-4 rounded-[16px] border bg-charbon-800 p-4 transition-colors",
                line.expired
                  ? "cursor-default border-neon-rouge/40 opacity-70"
                  : checked
                    ? "cursor-pointer border-carmin/50"
                    : "cursor-pointer border-charbon-500 opacity-80",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={line.expired}
                onChange={() => toggle(line.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-carmin disabled:opacity-40"
              />
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
                  <span style={{ color: conditionColor(line.conditionCode) }}>
                    {tCond(line.conditionCode)}
                  </span>
                </p>
                <p className="text-[11px] font-bold text-texte-faible">{line.sellerName}</p>
                {line.expired && (
                  <p className="mt-1 text-[10.5px] font-extrabold tracking-[1px] text-neon-rouge uppercase">
                    {t("lineExpired")}
                  </p>
                )}
                <div className="mt-2" onClick={(e) => e.preventDefault()}>
                  <MarketplaceCartRemoveButton itemId={line.id} />
                </div>
              </div>
              <p className="font-display shrink-0 text-[18px] text-blanc-casse">{line.priceLabel}</p>
            </label>
          );
        })}
      </div>

      <div className="sticky top-18 h-fit rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h3 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("summary")}</h3>
        <p className="mt-2 text-[11px] font-bold text-texte-faible">{t("selectionHint")}</p>
        <div className="mt-4 flex flex-col gap-2 text-[13px] font-bold">
          <div className="flex justify-between text-texte-dim">
            <span>{t("selectedCount", { count: selectedLines.length })}</span>
            <span>{selectedTotalLabel}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-charbon-500 pt-3 text-blanc-casse">
            <span className="font-extrabold">{t("total")}</span>
            <span className="font-display text-[20px] text-carmin">{selectedTotalLabel}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={goToRecap}
          disabled={selectedLines.length === 0}
          className="font-display mt-5 flex w-full items-center justify-center rounded-[12px] bg-carmin py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition-colors hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("goToRecap")}
        </button>
      </div>
    </div>
  );
}
