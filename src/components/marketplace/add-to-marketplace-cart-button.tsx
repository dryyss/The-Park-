"use client";

import { useState, useTransition } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  addToMarketplaceCartAction,
  type MarketplaceCartActionError,
} from "@/server/marketplace-cart/marketplace-cart.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

const addClassName =
  "font-display -skew-x-3 rounded-lg border-[1.5px] border-carmin bg-carmin px-3 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap text-white uppercase transition hover:-translate-y-0.5 hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-60";

const addedClassName =
  "font-display -skew-x-3 rounded-lg border-[1.5px] border-statut-succes bg-statut-succes/12 px-3 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap text-statut-succes uppercase transition hover:-translate-y-0.5 hover:bg-statut-succes/20";

export function AddToMarketplaceCartButton({
  listingId,
  inCart = false,
}: {
  listingId: string;
  inCart?: boolean;
}) {
  const t = useTranslations("marketplace");
  const { user } = useUser();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(inCart);
  const [error, setError] = useState<MarketplaceCartActionError | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);

  const isInCart = added || inCart;

  function handleAdd() {
    if (!user) {
      setShowLoginGate(true);
      return;
    }
    setError(null);
    setShowLoginGate(false);
    startTransition(async () => {
      const result = await addToMarketplaceCartAction({ listingId });
      if (result.ok) {
        setAdded(true);
      } else {
        if (result.error === "UNAUTHORIZED") setShowLoginGate(true);
        else setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateBuy" />}
      {isInCart ? (
        <Link href="/marketplace/panier" className={`text-center ${addedClassName}`}>
          {t("actionAddedToCart")}
        </Link>
      ) : (
        <button type="button" onClick={handleAdd} disabled={pending} className={addClassName}>
          {pending ? t("actionAddingToCart") : t("actionAddToCart")}
        </button>
      )}
      {error && (
        <span className="text-center text-[10px] font-bold text-neon-rouge">
          {t(`cartError.${error}`)}
        </span>
      )}
    </div>
  );
}
