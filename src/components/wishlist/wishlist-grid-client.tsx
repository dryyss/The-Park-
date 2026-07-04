"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { removeFromWishlistAction } from "@/server/wishlist/wishlist.actions";
import type { WishlistCard } from "@/server/wishlist/wishlist.service";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { rarityMeta } from "@/lib/rarity";
import { conditionColor } from "@/lib/condition";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";
import { WishlistAlertControl } from "@/components/wishlist/wishlist-alert-control";

export function WishlistGridClient({
  items,
  isAuthenticated,
}: {
  items: WishlistCard[];
  isAuthenticated: boolean;
}) {
  const t = useTranslations("wishlist");
  const tCond = useTranslations("conditions");
  const tCard = useTranslations("card");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showLoginGate, setShowLoginGate] = useState(false);

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
        <Link href="/recherche" className="mt-4 inline-block text-[13px] font-extrabold text-carmin hover:underline">
          {t("browse")}
        </Link>
      </div>
    );
  }

  function remove(id: string) {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    startTransition(async () => {
      await removeFromWishlistAction(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {showLoginGate && <LoginGatePrompt messageKey="loginGateWishlist" />}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((card) => {
        const meta = rarityMeta(card.rarityCode);
        return (
          <div key={card.id} className="group rounded-[16px] border border-charbon-500 bg-charbon-800 p-3 transition hover:border-carmin">
            <Link href={`/carte/${card.slug}`} className="block">
              <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-[10px] bg-charbon-700">
                {card.image && (
                  <Image src={card.image} alt={card.name} fill className="object-cover transition group-hover:scale-105" sizes="200px" />
                )}
                <span
                  className="absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-extrabold"
                  style={{ background: `${meta.color}22`, color: meta.color }}
                >
                  {meta.glyph} #{String(card.number).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-2.5 truncate text-[13px] font-extrabold text-blanc-casse">{card.name}</p>
              <p className="mt-1 text-[10px] font-bold text-texte-dim">{t("itemSeason", { season: card.seasonName })}</p>
              <p className="text-[11px] font-bold text-texte-doux">
                {card.versionLabel}
                {" · "}
                <span style={{ color: conditionColor(card.conditionCode) }}>{tCond(card.conditionCode)}</span>
              </p>
              <p className="text-[10.5px] font-bold text-texte-faible">
                {card.isFirstEdition ? tCard("editionFirst") : tCard("editionReedition")}
              </p>
              <p className="text-[11px] font-bold text-texte-dim">{card.quoteValue}</p>
            </Link>
            <WishlistAlertControl
              wishlistItemId={card.id}
              alertPrice={card.alertPrice}
              onRequireAuth={() => {
                if (!isAuthenticated) {
                  setShowLoginGate(true);
                  return true;
                }
                return false;
              }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(card.id)}
              className="mt-1.5 w-full rounded-lg border border-charbon-500 py-1.5 text-[11px] font-extrabold text-texte-dim hover:border-neon-rouge hover:text-neon-rouge disabled:opacity-50"
            >
              {t("remove")}
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
