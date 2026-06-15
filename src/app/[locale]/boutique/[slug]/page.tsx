import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getShopProductBySlug } from "@/server/shop/shop.service";
import { ShopOfficialBanner } from "@/components/shop/shop-sections";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

export const dynamic = "force-dynamic";

export default async function BoutiqueProduitPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shop");

  const product = await getShopProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-8 pb-[60px]">
      <ShopOfficialBanner />
      <div className="mb-4 flex items-center gap-2 text-[12.5px] font-bold text-texte-dim">
        <Link href="/boutique" className="hover:text-carmin">
          {t("breadcrumbShop")}
        </Link>
        <span className="text-charbon-400">/</span>
        <span className="text-texte-doux">{product.name}</span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative flex min-h-[360px] items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_50%_38%,#FFFFFF,#ECE6E8_78%)] p-8">
          {product.image && (
            <Image src={product.image} alt={product.name} width={420} height={420} className="object-contain" />
          )}
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-extrabold tracking-[2px] text-or uppercase">{product.categoryLabel}</span>
          <h1 className="font-display mt-2 text-[clamp(32px,4vw,48px)] leading-none -skew-x-3 uppercase text-blanc-casse">
            {product.name}
          </h1>
          {product.description && <p className="mt-4 text-[14px] leading-relaxed text-texte-doux">{product.description}</p>}
          <div className="font-display mt-6 text-[40px] text-blanc-casse">{product.price}</div>
          <p className="mt-2 text-[12px] font-bold text-texte-dim">
            {product.inStock ? t("inStock", { count: product.stock }) : t("soldOut")}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <AddToCartButton
              productId={product.id}
              inStock={product.inStock}
              stock={product.stock}
              locale={locale}
            />
            <Link href="/boutique" className="font-display -skew-x-3 self-start rounded-[11px] border border-charbon-400 px-6 py-3.5 text-[14px] tracking-wide text-blanc-casse uppercase transition hover:border-carmin">
              {t("backToCatalog")}
            </Link>
          </div>
          <p className="mt-4 text-[11px] font-bold text-neon-vert">✓ {t("stripeSecure")}</p>
        </div>
      </div>
    </main>
  );
}
