"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { removeCartItemAction, setCartQuantityAction } from "@/server/cart/cart.actions";

interface CartLineControlsProps {
  itemId: string;
  quantity: number;
  stock: number;
}

export function CartLineControls({ itemId, quantity, stock }: CartLineControlsProps) {
  const t = useTranslations("cart");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const max = Math.min(stock, 20);

  function setQuantity(next: number) {
    startTransition(async () => {
      await setCartQuantityAction({ itemId, quantity: next });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItemAction({ itemId });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-[9px] border border-charbon-400 bg-charbon-700">
        <button
          type="button"
          aria-label={t("decrease")}
          onClick={() => setQuantity(quantity - 1)}
          disabled={pending}
          className="px-2.5 py-1.5 text-[15px] text-texte-doux transition hover:text-white disabled:opacity-40"
        >
          −
        </button>
        <span className="font-display w-7 text-center text-[13px] text-blanc-casse">{quantity}</span>
        <button
          type="button"
          aria-label={t("increase")}
          onClick={() => setQuantity(quantity + 1)}
          disabled={pending || quantity >= max}
          className="px-2.5 py-1.5 text-[15px] text-texte-doux transition hover:text-white disabled:opacity-40"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase transition hover:text-neon-rouge disabled:opacity-40"
      >
        {t("remove")}
      </button>
    </div>
  );
}
