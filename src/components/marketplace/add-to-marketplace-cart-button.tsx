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

export function AddToMarketplaceCartButton({
  listingId,
  className,
}: {
  listingId: string;
  className?: string;
}) {
  const t = useTranslations("marketplace");
  const { user } = useUser();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<MarketplaceCartActionError | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);

  function handleAdd() {
    if (!user) {
      setShowLoginGate(true);
      return;
    }
    setError(null);
    setShowLoginGate(false);
    setAdded(false);
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
      <button type="button" onClick={handleAdd} disabled={pending} className={className}>
        {pending ? t("actionAddingToCart") : added ? t("actionAddedToCart") : t("actionAddToCart")}
      </button>
      {added && !error && (
        <Link
          href="/marketplace/panier"
          className="text-center text-[10px] font-extrabold tracking-wide text-neon-vert uppercase hover:underline"
        >
          {t("viewCart")}
        </Link>
      )}
      {error && (
        <span className="text-center text-[10px] font-bold text-neon-rouge">
          {t(`cartError.${error}`)}
        </span>
      )}
    </div>
  );
}
