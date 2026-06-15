import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShopOfficialBanner } from "@/components/shop/shop-sections";
import { CartLineControls } from "@/components/cart/cart-line-controls";
import type { CartSummary } from "@/server/cart/cart.service";

export async function CartView({ cart }: { cart: CartSummary }) {
  const t = await getTranslations("cart");

  return (
    <div>
      <ShopOfficialBanner />
      {cart.lines.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[14px] font-bold text-texte-dim">{t("empty")}</p>
          <Link href="/boutique" className="mt-4 inline-block font-display text-[14px] tracking-wide text-carmin uppercase hover:underline">
            {t("continueShopping")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {cart.lines.map((line) => (
              <div key={line.id} className="flex gap-4 rounded-[16px] border border-charbon-500 bg-charbon-800 p-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-charbon-700">
                  {line.image && <Image src={line.image} alt={line.name} fill className="object-cover" sizes="80px" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/boutique/${line.slug}`} className="text-[14px] font-extrabold text-blanc-casse hover:text-carmin">
                    {line.name}
                  </Link>
                  <p className="text-[12px] font-bold text-texte-dim">{line.unitPrice}</p>
                  {!line.inStock && <p className="mt-1 text-[11px] font-extrabold text-neon-rouge">{t("stockWarning")}</p>}
                  <div className="mt-2.5">
                    <CartLineControls itemId={line.id} quantity={line.quantity} stock={line.stock} />
                  </div>
                </div>
                <p className="font-display shrink-0 text-[18px] text-or">{line.lineTotal}</p>
              </div>
            ))}
          </div>
          <div className="h-fit rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
            <h3 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("summary")}</h3>
            <div className="mt-4 flex flex-col gap-2 text-[13px] font-bold">
              <div className="flex justify-between text-texte-dim">
                <span>{t("subtotal")}</span>
                <span>{cart.subtotal}</span>
              </div>
              <div className="flex justify-between text-texte-dim">
                <span>{t("shipping")}</span>
                <span>{cart.shippingEstimate}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-charbon-500 pt-3 text-blanc-casse">
                <span className="font-extrabold">{t("total")}</span>
                <span className="font-display text-[20px] text-or">{cart.total}</span>
              </div>
            </div>
            <Link
              href="/boutique/checkout"
              className="font-display mt-5 flex w-full items-center justify-center rounded-[12px] bg-carmin py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt"
            >
              {t("checkout")}
            </Link>
            <p className="mt-3 text-center text-[10px] font-bold text-texte-faible">{t("stripeHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
