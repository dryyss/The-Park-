"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { removeFromMarketplaceCartAction } from "@/server/marketplace-cart/marketplace-cart.actions";

export function MarketplaceCartRemoveButton({ itemId }: { itemId: string }) {
  const t = useTranslations("marketplaceCart");
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      await removeFromMarketplaceCartAction({ itemId });
      window.location.reload();
    });
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={pending}
      className="text-[11px] font-extrabold tracking-wide text-texte-faible uppercase transition hover:text-neon-rouge disabled:opacity-50"
    >
      {pending ? "…" : t("remove")}
    </button>
  );
}
