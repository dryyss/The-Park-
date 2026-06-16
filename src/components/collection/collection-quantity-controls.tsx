"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { adjustCollectionCardAction } from "@/server/collection/collection.actions";
import { QuantityStepper } from "@/components/collection/quantity-stepper";
import { ConditionPicker } from "@/components/collection/condition-picker";
import type { ConditionCode } from "@/lib/condition";

export function CollectionQuantityControls({
  cardNumber,
  quantity,
}: {
  cardNumber: number;
  quantity: number;
}) {
  const t = useTranslations("collection");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [condition, setCondition] = useState<ConditionCode>("EXCELLENT");

  function adjust(delta: 1 | -1) {
    setError(null);
    startTransition(async () => {
      const res = await adjustCollectionCardAction({ cardNumber, delta, condition });
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
    <div className="mt-1.5 flex flex-col gap-1.5">
      <ConditionPicker value={condition} onChange={setCondition} disabled={pending} compact />
      <QuantityStepper
        quantity={quantity}
        min={0}
        max={99}
        pending={pending}
        error={error}
        onIncrease={() => adjust(1)}
        onDecrease={() => adjust(-1)}
        increaseLabel={t("qtyIncrease")}
        decreaseLabel={t("qtyDecrease")}
      />
    </div>
  );
}
