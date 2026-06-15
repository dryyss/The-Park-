"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addToCollectionAction, removeFromCollectionAction } from "@/server/collection/collection.actions";
import { addToWishlistAction } from "@/server/wishlist/wishlist.actions";

export function CardMemberActions({
  cardId,
  cardSlug,
  isAuthenticated,
  versions,
}: {
  cardId: string;
  cardSlug: string;
  isAuthenticated: boolean;
  versions: { variantId: string; code: string; label: string; owned: boolean }[];
}) {
  const t = useTranslations("card");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  function handleToggle(variantId: string, owned: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = owned
        ? await removeFromCollectionAction({ variantId })
        : await addToCollectionAction({ variantId });
      if (res.ok) {
        router.refresh();
      } else {
        setMessage(res.error);
      }
    });
  }

  function handleWishlist() {
    setMessage(null);
    startTransition(async () => {
      const res = await addToWishlistAction({ cardId });
      if (res.ok) router.refresh();
      else setMessage(res.error);
    });
  }

  return (
    <div className="mt-6 rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <div className="mb-3 text-[11px] font-extrabold tracking-[2.5px] text-texte-dim uppercase">{t("manageTitle")}</div>
      <div className="flex flex-wrap gap-2">
        {versions.map((v) => (
          <button
            key={v.variantId}
            type="button"
            disabled={pending}
            onClick={() => handleToggle(v.variantId, v.owned)}
            className={`rounded-lg px-3 py-2 text-[12px] font-extrabold transition disabled:opacity-50 ${
              v.owned ? "border border-statut-succes/50 bg-statut-succes/10 text-statut-succes" : "border border-charbon-500 bg-charbon text-texte-doux hover:border-carmin"
            }`}
          >
            {v.owned ? t("removeVersion", { label: v.label }) : t("addVersion", { label: v.label })}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={handleWishlist}
          className="rounded-lg border border-or/40 bg-or/10 px-3 py-2 text-[12px] font-extrabold text-or hover:bg-or/20 disabled:opacity-50"
        >
          {t("addWishlist")}
        </button>
      </div>
      {message && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{message}</p>}
    </div>
  );
}
