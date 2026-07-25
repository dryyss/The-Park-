"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { adjustCollectionCardAction } from "@/server/collection/collection.actions";
import { QuantityStepper } from "@/components/collection/quantity-stepper";
import { ConditionPicker } from "@/components/collection/condition-picker";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";
import type { ConditionCode } from "@/lib/condition";

/** Délai avant de resynchroniser la page, pour absorber une rafale de clics. */
const REFRESH_DEBOUNCE_MS = 600;

export function CollectionQuantityControls({
  cardId,
  cardNumber,
  quantity,
  edition,
  isAuthenticated,
}: {
  cardId: string;
  cardNumber: number;
  quantity: number;
  edition?: "first" | "reprint" | null;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("collection");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [condition, setCondition] = useState<ConditionCode>("EXCELLENT");
  // Quantité optimiste : le compteur bouge dès le clic sans attendre le serveur
  // (sinon rien ne change à l'écran tant qu'on ne recharge pas la page).
  const [optimisticQty, setOptimisticQty] = useState(quantity);
  // Nombre d'ajustements en vol : tant qu'il y en a, la valeur serveur est
  // périmée et ne doit pas écraser le compteur optimiste.
  const inFlight = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inFlight.current === 0) setOptimisticQty(quantity);
  }, [quantity]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      if (inFlight.current === 0) router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

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

    // Volontairement hors `useTransition` : chaque clic part immédiatement et les
    // boutons restent actifs, la resynchronisation de la page vient après coup.
    inFlight.current += 1;
    void adjustCollectionCardAction({ cardId, cardNumber, delta, condition, edition })
      .then((res) => {
        if (!res.ok) {
          setOptimisticQty((q) => Math.max(0, Math.min(99, q - delta)));
          if (res.error === "UNAUTHORIZED") setShowLoginGate(true);
          else if (res.error === "RESERVED" || res.error === "BELOW_RESERVED") setError(t("qtyReserved"));
          else setError(t("qtyError"));
        }
      })
      .catch(() => {
        setOptimisticQty((q) => Math.max(0, Math.min(99, q - delta)));
        setError(t("qtyError"));
      })
      .finally(() => {
        inFlight.current -= 1;
        scheduleRefresh();
      });
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateCollection" />}
      <ConditionPicker value={condition} onChange={setCondition} compact />
      <QuantityStepper
        quantity={optimisticQty}
        min={0}
        max={99}
        error={error}
        onIncrease={() => adjust(1)}
        onDecrease={() => adjust(-1)}
        increaseLabel={t("qtyIncrease")}
        decreaseLabel={t("qtyDecrease")}
      />
    </div>
  );
}
