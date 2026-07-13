"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { VariantConditionManager, type ConditionRow } from "@/components/collection/variant-condition-manager";
import { LoginGatePrompt } from "@/components/collection/login-gate-prompt";
import { WishlistAddForm } from "@/components/wishlist/wishlist-add-form";

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
  seasonId,
  seasonLabel,
  isAuthenticated,
  versions,
}: {
  cardId: string;
  seasonId: string;
  seasonLabel: string;
  isAuthenticated: boolean;
  versions: CardVersionRow[];
}) {
  const t = useTranslations("card");
  const [message, setMessage] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [showWishlistForm, setShowWishlistForm] = useState(false);

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
                <span className={`text-[11px] font-bold ${v.owned ? "text-statut-succes" : "text-texte-faible"}`}>
                  {v.owned ? t("versionQty", { count: v.quantity }) : t("versionMissing")}
                </span>
              </div>
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
          onClick={() => {
            if (!isAuthenticated) {
              setShowLoginGate(true);
              return;
            }
            setShowLoginGate(false);
            setMessage(null);
            setShowWishlistForm((v) => !v);
          }}
          className="self-start rounded-lg border border-or/40 bg-or/10 px-3 py-2 text-[12px] font-extrabold text-or hover:bg-or/20"
        >
          {t("addWishlist")}
        </button>
        {showWishlistForm && isAuthenticated && (
          <WishlistAddForm
            cardId={cardId}
            seasonId={seasonId}
            seasonLabel={seasonLabel}
            versions={versions.map((v) => ({
              variantId: v.variantId,
              label: v.label,
              catalogEditionLabel: v.catalogEditionLabel,
            }))}
            onClose={() => setShowWishlistForm(false)}
          />
        )}
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
