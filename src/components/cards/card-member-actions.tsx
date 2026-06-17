"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addToWishlistAction } from "@/server/wishlist/wishlist.actions";
import { VariantConditionManager, type ConditionRow } from "@/components/collection/variant-condition-manager";
import { VariantEditionEditor } from "@/components/collection/variant-edition-editor";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";

export type CardVersionRow = {
  variantId: string;
  code: string;
  label: string;
  owned: boolean;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  catalogEditionLabel: string | null;
  userEditionLabel: string | null;
  editionLabel: string | null;
  isFirstEdition: boolean;
  conditions: ConditionRow[];
};

export function CardMemberActions({
  cardId,
  isAuthenticated,
  versions,
}: {
  cardId: string;
  isAuthenticated: boolean;
  versions: CardVersionRow[];
}) {
  const t = useTranslations("card");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);

  function handleWishlist() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    setMessage(null);
    setShowLoginGate(false);
    startTransition(async () => {
      const res = await addToWishlistAction({ cardId });
      if (res.ok) router.refresh();
      else setMessage(res.error);
    });
  }

  return (
    <div className="mt-6 rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <div className="mb-3 text-[11px] font-extrabold tracking-[2.5px] text-texte-dim uppercase">{t("manageTitle")}</div>
      {!isAuthenticated && (
        <div className="mb-4">
          <LoginGatePrompt messageKey="loginGateCollection" />
        </div>
      )}
      <div className="flex flex-col gap-3">
        {versions.map((v) => (
          <div
            key={v.variantId}
            className={`rounded-xl border px-4 py-3 ${
              v.owned ? "border-statut-succes/45 bg-statut-succes/8" : "border-charbon-500 bg-charbon"
            }`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`text-[13px] font-extrabold ${v.owned ? "text-blanc-casse" : "text-texte-dim"}`}>{v.label}</div>
                {v.isFirstEdition && (
                  <span className="font-display rounded bg-carmin px-2 py-0.5 text-[9px] tracking-[1px] text-white">
                    {t("firstEditionBadge")}
                  </span>
                )}
                <span className={`text-[11px] font-bold ${v.owned ? "text-statut-succes" : "text-texte-faible"}`}>
                  {v.owned ? t("versionQty", { count: v.quantity }) : t("versionMissing")}
                </span>
              </div>
              {isAuthenticated && (
                <VariantEditionEditor
                  variantId={v.variantId}
                  owned={v.owned}
                  userEditionLabel={v.userEditionLabel}
                  catalogEditionLabel={v.catalogEditionLabel}
                  editionLabel={v.editionLabel}
                />
              )}
              {!isAuthenticated && (
                <p className="mt-1 text-[10.5px] font-bold text-texte-faible">
                  {v.catalogEditionLabel ? t("editionCatalog", { label: v.catalogEditionLabel }) : t("editionReedition")}
                </p>
              )}
              <VariantConditionManager
                variantId={v.variantId}
                conditions={v.conditions}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={handleWishlist}
          className="self-start rounded-lg border border-or/40 bg-or/10 px-3 py-2 text-[12px] font-extrabold text-or hover:bg-or/20 disabled:opacity-50"
        >
          {t("addWishlist")}
        </button>
      </div>
      {showLoginGate && (
        <div className="mt-3">
          <LoginGatePrompt compact messageKey="loginGateCollection" />
        </div>
      )}
      {message && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{message}</p>}
    </div>
  );
}
