"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CONDITION_ORDER, conditionColor, type ConditionCode } from "@/lib/condition";
import { adjustCollectionVariantAction, updateCollectionGradingAction, updateCollectionSignatureAction } from "@/server/collection/collection.actions";
import { listCollectionItemAction, cancelListingAction } from "@/server/marketplace/marketplace.actions";
import { CollectionPhotoManager } from "@/components/collection/collection-photo-manager";
import { QuantityStepper } from "@/components/collection/quantity-stepper";
import type { CollectionItemPhotoView } from "@/server/collection/collection-photos.service";

type ListingType = "SELL" | "TRADE" | "SELL_OR_TRADE";

export type ConditionRow = {
  condition: string;
  quantity: number;
  reservedQuantity: number;
  available: number;
  isGraded: boolean;
  isSigned: boolean;
  signatureAuthor: string | null;
  photos: CollectionItemPhotoView[];
  listings: { id: string; type: string; price: string | null }[];
};

export function VariantConditionManager({
  variantId,
  conditions,
  isAuthenticated,
}: {
  variantId: string;
  conditions: ConditionRow[];
  isAuthenticated: boolean;
}) {
  const t = useTranslations("card");
  const tc = useTranslations("conditions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sellFor, setSellFor] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState<ConditionCode>("EXCELLENT");

  if (!isAuthenticated) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "ERR");
        return;
      }
      setSellFor(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {conditions.length === 0 && (
        <p className="text-[11px] font-bold text-texte-faible">{t("noConditions")}</p>
      )}

      {conditions.map((c) => (
        <div key={c.condition} className="rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-extrabold" style={{ color: conditionColor(c.condition) }}>
                {tc(c.condition)}
              </span>
              <span className="text-[11px] font-bold text-texte-dim">
                {c.reservedQuantity > 0
                  ? t("versionQtyReserved", { count: c.quantity, reserved: c.reservedQuantity })
                  : t("versionQty", { count: c.quantity })}
              </span>
            </div>
            <QuantityStepper
              quantity={c.quantity}
              min={c.reservedQuantity}
              max={99}
              pending={pending}
              onIncrease={() => run(() => adjustCollectionVariantAction({ variantId, delta: 1, condition: c.condition }))}
              onDecrease={() => run(() => adjustCollectionVariantAction({ variantId, delta: -1, condition: c.condition }))}
              increaseLabel={t("addVersion", { label: tc(c.condition) })}
              decreaseLabel={t("removeVersion", { label: tc(c.condition) })}
              compact
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("gradingLabel")}</span>
            {([true, false] as const).map((graded) => (
              <button
                key={graded ? "yes" : "no"}
                type="button"
                disabled={pending}
                onClick={() => run(() => updateCollectionGradingAction({ variantId, condition: c.condition, isGraded: graded }))}
                className={[
                  "rounded-md border px-2.5 py-1 text-[10.5px] font-extrabold transition disabled:opacity-50",
                  c.isGraded === graded
                    ? "border-carmin bg-carmin/15 text-blanc-casse"
                    : "border-charbon-500 text-texte-dim hover:border-charbon-400",
                ].join(" ")}
              >
                {graded ? t("gradingYes") : t("gradingNo")}
              </button>
            ))}
          </div>

          <SignatureAuthorField
            variantId={variantId}
            condition={c.condition}
            isSigned={c.isSigned}
            signatureAuthor={c.signatureAuthor}
            pending={pending}
            onRun={run}
          />

          <CollectionPhotoManager variantId={variantId} condition={c.condition} photos={c.photos} />

          <div className="mt-2 flex flex-col gap-1.5">
            {c.listings.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-or/12 px-2 py-1 text-[10.5px] font-extrabold text-or">
                  {l.type === "TRADE"
                    ? t("listingTrade")
                    : l.type === "SELL_OR_TRADE"
                      ? t("listingBoth", { price: l.price ?? "—" })
                      : t("listingSell", { price: l.price ?? "—" })}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => cancelListingAction({ listingId: l.id }))}
                  className="text-[10.5px] font-bold text-neon-rouge transition hover:underline disabled:opacity-50"
                >
                  {t("removeListing")}
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {c.available > 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setSellFor(sellFor === c.condition ? null : c.condition)}
                  className="rounded-md border border-carmin/50 px-2.5 py-1 text-[10.5px] font-extrabold text-carmin transition hover:bg-carmin/10 disabled:opacity-50"
                >
                  {t("sellOrTrade")}
                </button>
              ) : (
                <span className="text-[10.5px] font-bold text-texte-faible">{t("allReserved")}</span>
              )}
            </div>
          </div>

          {sellFor === c.condition && (
            <ListItemForm
              pending={pending}
              onSubmit={(type, price) =>
                run(() => listCollectionItemAction({ variantId, condition: c.condition, type, price }))
              }
              onClose={() => setSellFor(null)}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-charbon-500 px-3 py-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("addCondition")}</span>
          <select
            value={newCondition}
            onChange={(e) => setNewCondition(e.target.value as ConditionCode)}
            className="rounded-md border border-charbon-500 bg-charbon-700 px-2 py-1 text-[11px] font-extrabold text-blanc-casse outline-none focus:border-carmin"
            style={{ color: conditionColor(newCondition) }}
          >
            {CONDITION_ORDER.map((code) => (
              <option key={code} value={code} className="text-blanc-casse">
                {tc(code)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => adjustCollectionVariantAction({ variantId, delta: 1, condition: newCondition }))}
          className="rounded-md bg-carmin px-3 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {t("add")}
        </button>
      </div>

      {error && <p className="text-[10.5px] font-bold text-neon-rouge">{t("listingError")}</p>}
    </div>
  );
}

function SignatureAuthorField({
  variantId,
  condition,
  isSigned,
  signatureAuthor,
  pending,
  onRun,
}: {
  variantId: string;
  condition: string;
  isSigned: boolean;
  signatureAuthor: string | null;
  pending: boolean;
  onRun: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useTranslations("card");
  const [author, setAuthor] = useState(signatureAuthor ?? "");

  useEffect(() => {
    setAuthor(signatureAuthor ?? "");
  }, [signatureAuthor, condition]);

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("signedLabel")}</span>
        {([true, false] as const).map((signed) => (
          <button
            key={signed ? "yes" : "no"}
            type="button"
            disabled={pending}
            onClick={() =>
              onRun(() =>
                updateCollectionSignatureAction({
                  variantId,
                  condition,
                  isSigned: signed,
                  signatureAuthor: signed ? author : null,
                }),
              )
            }
            className={[
              "rounded-md border px-2.5 py-1 text-[10.5px] font-extrabold transition disabled:opacity-50",
              isSigned === signed
                ? "border-or/70 bg-or/12 text-blanc-casse"
                : "border-charbon-500 text-texte-dim hover:border-charbon-400",
            ].join(" ")}
          >
            {signed ? t("gradingYes") : t("gradingNo")}
          </button>
        ))}
      </div>
      {isSigned && (
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("signatureAuthorLabel")}</span>
          <input
            type="text"
            value={author}
            maxLength={120}
            disabled={pending}
            placeholder={t("signatureAuthorPlaceholder")}
            onChange={(e) => setAuthor(e.target.value)}
            onBlur={() => {
              if ((signatureAuthor ?? "") === author.trim()) return;
              onRun(() =>
                updateCollectionSignatureAction({
                  variantId,
                  condition,
                  isSigned: true,
                  signatureAuthor: author,
                }),
              );
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }}
            className="w-full max-w-sm rounded-md border border-charbon-500 bg-charbon-700 px-2.5 py-1.5 text-[12px] font-bold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-or"
          />
        </label>
      )}
    </div>
  );
}

function ListItemForm({
  pending,
  onSubmit,
  onClose,
}: {
  pending: boolean;
  onSubmit: (type: ListingType, price?: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("card");
  const [type, setType] = useState<ListingType>("SELL");
  const [price, setPrice] = useState("");
  const needsPrice = type !== "TRADE";

  function submit() {
    const parsed = price.trim() ? parseFloat(price.replace(",", ".")) : undefined;
    onSubmit(type, parsed);
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-charbon-700/60 p-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("listingTypeLabel")}</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ListingType)}
          className="rounded-md border border-charbon-500 bg-charbon px-2 py-1.5 text-[11px] font-extrabold text-blanc-casse outline-none focus:border-carmin"
        >
          <option value="SELL">{t("listingTypeSell")}</option>
          <option value="TRADE">{t("listingTypeTrade")}</option>
          <option value="SELL_OR_TRADE">{t("listingTypeBoth")}</option>
        </select>
      </label>
      {needsPrice && (
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("listingPrice")}</span>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-28 rounded-md border border-charbon-500 bg-charbon px-2.5 py-1.5 pr-7 text-[13px] font-bold text-blanc-casse outline-none focus:border-carmin"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-texte-faible">€</span>
          </div>
        </label>
      )}
      <button
        type="button"
        disabled={pending || (needsPrice && !price.trim())}
        onClick={submit}
        className="rounded-md bg-carmin px-3 py-2 text-[11px] font-extrabold text-white transition hover:bg-carmin-alt disabled:opacity-50"
      >
        {t("listingPublish")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onClose}
        className="rounded-md border border-charbon-500 px-3 py-2 text-[11px] font-extrabold text-texte-dim transition hover:border-charbon-400 disabled:opacity-50"
      >
        {t("close")}
      </button>
    </div>
  );
}
