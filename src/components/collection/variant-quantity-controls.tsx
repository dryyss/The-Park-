"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { adjustCollectionVariantAction } from "@/server/collection/collection.actions";
import { QuantityStepper } from "@/components/collection/quantity-stepper";
import { ConditionPicker } from "@/components/collection/condition-picker";
import type { ConditionCode } from "@/lib/condition";

export function VariantQuantityControls({
  variantId,
  quantity,
  minQuantity = 0,
  compact = false,
}: {
  variantId: string;
  quantity: number;
  /** Quantité minimale (ex. réservée pour annonce/échange) — bloque le − en dessous. */
  minQuantity?: number;
  compact?: boolean;
}) {
  const t = useTranslations("collection");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [condition, setCondition] = useState<ConditionCode>("EXCELLENT");

  function adjust(delta: 1 | -1) {
    setError(null);
    startTransition(async () => {
      const res = await adjustCollectionVariantAction({ variantId, delta, condition });
      if (!res.ok) {
        if (res.error === "UNAUTHORIZED") setError(t("qtyLoginRequired"));
        else if (res.error === "RESERVED" || res.error === "BELOW_RESERVED") setError(t("qtyReserved"));
        else setError(t("qtyError"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={`flex flex-col gap-2 ${compact ? "items-end" : ""}`}>
      <ConditionPicker
        value={condition}
        onChange={setCondition}
        disabled={pending}
        compact={compact}
      />
      <QuantityStepper
        quantity={quantity}
        min={minQuantity}
        max={99}
        pending={pending}
        error={error}
        onIncrease={() => adjust(1)}
        onDecrease={() => adjust(-1)}
        increaseLabel={t("qtyIncrease")}
        decreaseLabel={t("qtyDecrease")}
        compact={compact}
      />
    </div>
  );
}
