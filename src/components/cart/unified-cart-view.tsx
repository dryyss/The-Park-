import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { CartLineControls } from "@/components/cart/cart-line-controls";
import { MarketplaceCartClient } from "@/components/marketplace/marketplace-cart-client";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerCart } from "@/server/cart/cart.service";
import { getViewerMarketplaceCart } from "@/server/marketplace-cart/marketplace-cart.service";

/**
 * Panier unifié — affiche la boutique officielle + le marketplace
 * dans une seule page avec deux sections distinctes.
 * Chaque section conserve son propre flow de checkout.
 */
export async function UnifiedCartView({ locale }: { locale: string }) {
  const t = await getTranslations("unifiedCart");
  const tCart = await getTranslations("cart");
  const tMkt = await getTranslations("marketplaceCart");

  const viewer = await getViewerUser();

  const shopCart = viewer
    ? await getViewerCart(viewer.id)
    : { lines: [], itemCount: 0, subtotal: "0,00 €", subtotalRaw: 0, shippingEstimate: "0,00 €", total: "0,00 €" };

  const mktCart = viewer
    ? await getViewerMarketplaceCart(viewer.id)
    : { lines: [], itemCount: 0, subtotal: "0,00 €", subtotalRaw: 0 };

  const hasShop = shopCart.lines.length > 0;
  const hasMkt = mktCart.lines.length > 0;
  const isEmpty = !hasShop && !hasMkt;

  return (
    <div className="flex flex-col gap-10">
      {/* Section boutique officielle */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-or text-[12px] font-black text-charbon">✔</span>
          <h2 className="font-display text-[13px] tracking-[1.5px] text-or uppercase">{t("shopSection")}</h2>
          {hasShop && (
            <span className="ml-auto text-[11px] font-extrabold text-texte-dim">
              {shopCart.itemCount} {shopCart.itemCount > 1 ? t("items") : t("item")}
            </span>
          )}
        </div>

        {!viewer ? (
          <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-6">
            <GuestAuthBanner messageKey="loginGateShop" />
          </div>
        ) : !hasShop ? (
          <div className="rounded-[16px] border border-dashed border-charbon-500 bg-charbon-900 py-10 text-center">
            <p className="text-[13px] font-bold text-texte-dim">{tCart("empty")}</p>
            <Link href="/boutique" className="mt-3 inline-block font-display text-[12px] tracking-wide text-carmin uppercase hover:underline">
              {tCart("continueShopping")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-3">
              {shopCart.lines.map((line) => (
                <div key={line.id} className="flex gap-4 rounded-[16px] border border-charbon-500 bg-charbon-800 p-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-charbon-700">
                    {line.image && <Image src={line.image} alt={line.name} fill className="object-cover" sizes="80px" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/boutique/${line.slug}`} className="text-[14px] font-extrabold text-blanc-casse hover:text-carmin">
                      {line.name}
                    </Link>
                    <p className="text-[12px] font-bold text-texte-dim">{line.unitPrice}</p>
                    {!line.inStock && (
                      <p className="mt-1 text-[11px] font-extrabold text-neon-rouge">{tCart("stockWarning")}</p>
                    )}
                    <div className="mt-2.5">
                      <CartLineControls itemId={line.id} quantity={line.quantity} stock={line.stock} />
                    </div>
                  </div>
                  <p className="font-display shrink-0 text-[18px] text-or">{line.lineTotal}</p>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-[16px] border border-or/30 bg-charbon-800 p-5">
              <h3 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">{tCart("summary")}</h3>
              <div className="mt-4 flex flex-col gap-2 text-[13px] font-bold">
                <div className="flex justify-between text-texte-dim">
                  <span>{tCart("subtotal")}</span>
                  <span>{shopCart.subtotal}</span>
                </div>
                <div className="flex justify-between text-texte-dim">
                  <span>{tCart("shipping")}</span>
                  <span>{shopCart.shippingEstimate}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-charbon-500 pt-3 text-blanc-casse">
                  <span className="font-extrabold">{tCart("total")}</span>
                  <span className="font-display text-[18px] text-or">{shopCart.total}</span>
                </div>
              </div>
              <Link
                href="/boutique/checkout"
                className="font-display mt-5 flex w-full items-center justify-center rounded-[12px] bg-carmin py-3 text-[13px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:bg-carmin-alt"
              >
                {tCart("checkout")}
              </Link>
              <p className="mt-2 text-center text-[10px] font-bold text-texte-faible">{tCart("stripeHint")}</p>
            </div>
          </div>
        )}
      </section>

      {/* Séparateur */}
      <div className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-charbon-500" />
        <span className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("divider")}</span>
        <div className="h-px flex-1 bg-charbon-500" />
      </div>

      {/* Section marketplace */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-charbon-500 text-[12px] font-black text-blanc-casse">M</span>
          <h2 className="font-display text-[13px] tracking-[1.5px] text-texte-doux uppercase">{t("marketplaceSection")}</h2>
          {hasMkt && (
            <span className="ml-auto text-[11px] font-extrabold text-texte-dim">
              {mktCart.itemCount} {mktCart.itemCount > 1 ? t("items") : t("item")}
            </span>
          )}
        </div>

        <p className="mb-4 text-[11.5px] font-bold text-texte-faible">{tMkt("disclaimer")}</p>

        {!viewer ? (
          <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-6">
            <GuestAuthBanner messageKey="loginGateBuy" />
          </div>
        ) : (
          <MarketplaceCartClient cart={mktCart} locale={locale} />
        )}
      </section>

      {/* Panier complètement vide */}
      {viewer && isEmpty && (
        <div className="py-6 text-center">
          <p className="text-[13px] font-bold text-texte-dim">{t("allEmpty")}</p>
          <div className="mt-4 flex justify-center gap-5">
            <Link href="/boutique" className="font-display text-[12px] tracking-wide text-or uppercase hover:underline">
              {tCart("continueShopping")}
            </Link>
            <Link href="/marketplace" className="font-display text-[12px] tracking-wide text-carmin uppercase hover:underline">
              {tMkt("continueShopping")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
