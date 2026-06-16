"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { addToCartAction, type CartActionError } from "@/server/cart/cart.actions";

interface AddToCartButtonProps {
  productId: string;
  inStock: boolean;
  stock: number;
  locale: string;
}

export function AddToCartButton({ productId, inStock, stock, locale }: AddToCartButtonProps) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<CartActionError | null>(null);
  const [pending, startTransition] = useTransition();

  const max = Math.max(1, Math.min(stock, 20));

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addToCartAction({ productId, quantity: qty });
      if (result.ok) {
        setAdded(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className="font-display -skew-x-3 rounded-[11px] bg-charbon-600 px-7 py-3.5 text-[14px] tracking-[1.5px] text-texte-dim uppercase"
      >
        {t("soldOut")}
      </button>
    );
  }

  if (error === "UNAUTHORIZED") {
    const returnTo = encodeURIComponent(`/${locale}/boutique`);
    return (
      <a
        href={`/auth/login?returnTo=${returnTo}`}
        className="font-display -skew-x-3 rounded-[11px] bg-carmin px-7 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-carmin-alt hover:shadow-[7px_7px_0_rgba(0,0,0,0.55)] active:translate-y-0 active:shadow-[2px_2px_0_rgba(0,0,0,0.5)]"
      >
        {t("loginToBuy")}
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-[11px] border border-charbon-400 bg-charbon-800">
          <button
            type="button"
            aria-label={t("decrease")}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={pending || qty <= 1}
            className="rounded-l-[11px] px-3.5 py-3 text-[18px] text-texte-doux transition-colors duration-150 hover:bg-charbon-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
          >
            −
          </button>
          <span className="font-display w-9 text-center text-[16px] text-blanc-casse">{qty}</span>
          <button
            type="button"
            aria-label={t("increase")}
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            disabled={pending || qty >= max}
            className="rounded-r-[11px] px-3.5 py-3 text-[18px] text-texte-doux transition-colors duration-150 hover:bg-charbon-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={pending}
          className="font-display -skew-x-3 rounded-[11px] bg-carmin px-7 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-carmin-alt hover:shadow-[7px_7px_0_rgba(0,0,0,0.55)] active:translate-y-0 active:shadow-[2px_2px_0_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
        >
          {pending ? t("adding") : t("addToCart")}
        </button>
      </div>

      {added && !error && (
        <p className="flex items-center gap-2 text-[12.5px] font-extrabold text-neon-vert">
          ✓ {t("added")}
          <Link href="/boutique/panier" className="text-or underline underline-offset-2 hover:text-or-clair">
            {t("viewCart")}
          </Link>
        </p>
      )}
      {error && (
        <p className="text-[12.5px] font-bold text-neon-rouge">{t("addError")}</p>
      )}
    </div>
  );
}
