"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { addToWishlistAction } from "@/server/wishlist/wishlist.actions";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";

function wishlistErrorMessage(code: string, t: (key: string) => string): string {
  switch (code) {
    case "ALREADY_EXISTS":
      return t("errorDuplicate");
    case "UNAUTHORIZED":
      return t("errorUnauthorized");
    default:
      return t("errorGeneric");
  }
}

const addClassName =
  "font-display w-full -skew-x-3 rounded-lg border-[1.5px] border-or/50 bg-or/10 px-3 py-2 text-[10.5px] tracking-[1px] text-or uppercase transition hover:-translate-y-0.5 hover:bg-or/20 disabled:cursor-not-allowed disabled:opacity-60";

const addedClassName =
  "font-display w-full -skew-x-3 rounded-lg border-[1.5px] border-statut-succes/50 bg-statut-succes/10 px-3 py-2 text-[10.5px] tracking-[1px] text-statut-succes uppercase transition hover:-translate-y-0.5 hover:bg-statut-succes/20";

export function WishlistQuickAddButton({
  cardId,
  variantId,
  seasonId,
  isAuthenticated,
  inWishlist = false,
}: {
  cardId: string;
  variantId: string;
  seasonId: string;
  isAuthenticated: boolean;
  inWishlist?: boolean;
}) {
  const t = useTranslations("wishlist");
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(inWishlist);
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);

  const isInWishlist = added || inWishlist;

  function handleAdd() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    setError(null);
    setShowLoginGate(false);
    startTransition(async () => {
      const res = await addToWishlistAction({
        cardId,
        variantId,
        seasonId,
        condition: "EXCELLENT",
        editionPreset: "unlimited",
      });
      if (res.ok) {
        setAdded(true);
      } else {
        if (res.error === "UNAUTHORIZED") setShowLoginGate(true);
        else if (res.error === "ALREADY_EXISTS") setAdded(true);
        else setError(wishlistErrorMessage(res.error, t));
      }
    });
  }

  return (
    <div className="w-full">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateWishlist" />}
      {isInWishlist ? (
        <Link href="/wishlist" className={`block text-center ${addedClassName}`}>
          {t("tileAdded")}
        </Link>
      ) : (
        <button type="button" onClick={handleAdd} disabled={pending} className={addClassName}>
          {pending ? t("tileAdding") : t("tileAdd")}
        </button>
      )}
      {error && <p className="mt-1 text-center text-[10px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
