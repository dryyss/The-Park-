"use client";

import { useState, useTransition } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useTranslations } from "next-intl";
import { buyListingAction, type BuyListingError } from "@/server/sale/sale.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";
import { Link } from "@/i18n/navigation";

export function BuyListingButton({
  listingId,
  locale,
  className,
}: {
  listingId: string;
  locale: string;
  className?: string;
}) {
  const t = useTranslations("marketplace");
  const { user } = useUser();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<BuyListingError | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);

  function handleBuy() {
    if (!user) {
      setShowLoginGate(true);
      return;
    }
    setError(null);
    setShowLoginGate(false);
    startTransition(async () => {
      const result = await buyListingAction({ listingId, locale });
      if (result.ok) {
        window.location.href = result.redirectUrl;
      } else {
        if (result.error === "UNAUTHORIZED") setShowLoginGate(true);
        else setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateBuy" />}
      <button type="button" onClick={handleBuy} disabled={pending} className={className}>
        {pending ? t("actionBuying") : t("actionBuy")}
      </button>
      {error && (
        <span className="text-center text-[10px] font-bold text-neon-rouge">
          {t(`buyError.${error}`)}
          {error === "INSUFFICIENT_CREDIT" && (
            <>
              {" "}
              <Link href="/portefeuille" className="text-carmin underline">
                {t("walletTopUpLink")}
              </Link>
            </>
          )}
        </span>
      )}
    </div>
  );
}
