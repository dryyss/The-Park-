"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { conditionColor } from "@/lib/condition";
import { Link } from "@/i18n/navigation";
import { MarketplaceCartRemoveButton } from "@/components/marketplace/marketplace-cart-controls";
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
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(cart.lines.map((l) => [l.id, true])),
  );

  const selectedLines = useMemo(() => {
    const picked = cart.lines.filter((l) => checked[l.id]);
    return picked.length > 0 ? picked : cart.lines;
  }, [cart.lines, checked]);

  const selectedTotal = useMemo(
    () => selectedLines.reduce((s, l) => s + l.priceRaw, 0),
    [selectedLines],
  );

  const selectedTotalLabel = selectedTotal.toFixed(2).replace(".", ",") + " €";

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll(value: boolean) {
    setChecked(Object.fromEntries(cart.lines.map((l) => [l.id, value])));
  }

  function goToRecap() {
    const ids = selectedLines.map((l) => l.id);
    const param = ids.length === cart.lines.length ? "all" : ids.join(",");
    router.push(`/marketplace/panier/recap?items=${encodeURIComponent(param)}`);
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
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
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

        {cart.lines.map((line) => (
          <label
            key={line.id}
            className={[
              "flex cursor-pointer gap-4 rounded-[16px] border bg-charbon-800 p-4 transition",
              checked[line.id] ? "border-carmin/50" : "border-charbon-500 opacity-80",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={checked[line.id] ?? false}
              onChange={() => toggle(line.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-carmin"
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
              <div className="mt-2" onClick={(e) => e.preventDefault()}>
                <MarketplaceCartRemoveButton itemId={line.id} />
              </div>
            </div>
            <p className="font-display shrink-0 text-[18px] text-blanc-casse">{line.priceLabel}</p>
          </label>
        ))}
      </div>

      <div className="h-fit rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
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
          className="font-display mt-5 flex w-full items-center justify-center rounded-[12px] bg-carmin py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("goToRecap")}
        </button>
      </div>
    </div>
  );
}
