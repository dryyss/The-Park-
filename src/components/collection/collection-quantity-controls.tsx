"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { adjustCollectionCardAction } from "@/server/collection/collection.actions";
import { QuantityStepper } from "@/components/collection/quantity-stepper";
import { ConditionPicker } from "@/components/collection/condition-picker";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";
import type { ConditionCode } from "@/lib/condition";

export function CollectionQuantityControls({
  cardNumber,
  quantity,
  isAuthenticated,
}: {
  cardNumber: number;
  quantity: number;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("collection");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [condition, setCondition] = useState<ConditionCode>("EXCELLENT");
  // Quantité optimiste : le compteur bouge dès le clic sans attendre le serveur
  // (sinon rien ne change à l'écran tant qu'on ne recharge pas la page).
  const [optimisticQty, setOptimisticQty] = useState(quantity);
  useEffect(() => {
    setOptimisticQty(quantity);
  }, [quantity]);

  function adjust(delta: 1 | -1) {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    const prev = optimisticQty;
    const next = Math.max(0, Math.min(99, prev + delta));
    if (next === prev) return;
    setError(null);
    setShowLoginGate(false);
    setOptimisticQty(next);
    startTransition(async () => {
      const res = await adjustCollectionCardAction({ cardNumber, delta, condition });
      if (!res.ok) {
        setOptimisticQty(prev);
        if (res.error === "UNAUTHORIZED") setShowLoginGate(true);
        else if (res.error === "RESERVED" || res.error === "BELOW_RESERVED") setError(t("qtyReserved"));
        else setError(t("qtyError"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateCollection" />}
      <ConditionPicker value={condition} onChange={setCondition} disabled={pending} compact />
      <QuantityStepper
        quantity={optimisticQty}
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
