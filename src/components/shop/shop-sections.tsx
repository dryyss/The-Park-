import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ShopProduct } from "@/server/shop/shop.service";

export async function ShopOfficialBanner() {
  const t = await getTranslations("shop");

  return (
    <div className="mb-5 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2.5 rounded-[11px] border border-or/45 bg-gradient-to-br from-or/15 to-or/5 px-3.5 py-2">
        <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-or text-[14px] font-black text-charbon">✔</span>
        <div className="leading-tight">
          <div className="font-display text-[13px] tracking-wide text-blanc-casse">{t("officialBanner")}</div>
          <div className="text-[10px] font-extrabold tracking-wide text-or uppercase">{t("officialSub")}</div>
        </div>
      </div>
      <div className="flex-1" />
      <Link
        href="/marketplace"
        className="rounded-lg border border-dashed border-charbon-400 px-3 py-2 text-[11.5px] font-extrabold text-texte-faible transition hover:border-charbon-300 hover:text-texte-doux"
      >
        {t("marketplaceDisclaimer")}
      </Link>
    </div>
  );
}

export async function ShopHero({ product }: { product: ShopProduct }) {
  const t = await getTranslations("shop");

  return (
    <div className="grid overflow-hidden rounded-[22px] border border-charbon-500 md:grid-cols-[1.15fr_1fr]">
      <div className="relative flex min-h-[320px] items-center justify-center bg-[radial-gradient(circle_at_50%_38%,#FFFFFF,#ECE6E8_78%)] p-8">
        <span className="font-display absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-md bg-charbon px-3 py-1.5 text-[11px] tracking-wide text-or shadow-[3px_3px_0_rgba(0,0,0,0.2)] -rotate-2">
          <span className="h-1.5 w-1.5 rounded-full bg-or shadow-[0_0_8px_#E8B23A]" />
          {t("limitedEdition")}
        </span>
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            width={400}
            height={400}
            className="max-h-[380px] object-contain drop-shadow-[0_28px_40px_rgba(0,0,0,0.35)]"
          />
        )}
      </div>
      <div className="flex flex-col justify-center bg-charbon-800 p-10">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-[3px] text-or uppercase">{t("seasonDisplay")}</span>
          <span className="font-jp text-[11px] font-bold text-texte-faible">鍛造エンジン</span>
        </div>
        <h2 className="font-display text-[clamp(38px,4.4vw,56px)] leading-[0.94] -skew-x-3 uppercase text-blanc-casse">
          {product.name.split(" ").slice(0, -2).join(" ")}{" "}
          <span className="text-or [text-shadow:4px_4px_0_rgba(216,27,96,0.9)]">{product.name.split(" ").slice(-2).join(" ")}</span>
        </h2>
        {product.description && (
          <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-texte-doux">{product.description}</p>
        )}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div className="font-display text-[40px] leading-none text-blanc-casse">{product.price}</div>
          {product.lowStock && product.inStock && (
            <span className="mb-1 flex items-center gap-1.5 rounded-lg border border-[rgba(232,148,90,0.4)] bg-[rgba(232,148,90,0.12)] px-3 py-1.5 text-[11.5px] font-extrabold text-[#E8945A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8945A]" />
              {t("lowStock", { count: product.stock })}
            </span>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href={`/boutique/${product.slug}`}
            className="font-display inline-flex -skew-x-3 items-center gap-2 rounded-[11px] bg-carmin px-7 py-3.5 text-[15px] tracking-[1.5px] text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
          >
            {t("addToCart")}
          </Link>
          <Link
            href={`/boutique/${product.slug}`}
            className="font-display inline-block -skew-x-3 rounded-[11px] border-[1.5px] border-charbon-400 px-6 py-3.5 text-[15px] tracking-[1.5px] text-blanc-casse uppercase"
          >
            {t("viewProduct")}
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-[11.5px] font-bold text-texte-faible">
          <span className="text-neon-vert">✓ {t("stripeSecure")}</span>
          <span className="text-neon-vert">✓ {t("ships48h")}</span>
        </div>
      </div>
    </div>
  );
}

export async function ProductTile({ product }: { product: ShopProduct }) {
  const t = await getTranslations("shop");

  return (
    <Link href={`/boutique/${product.slug}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-charbon-500 bg-charbon-800 transition group-hover:-translate-y-1 group-hover:border-or/55 group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.45)]">
        <div className="relative flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#FFFFFF,#ECE6E8_82%)] p-5">
          <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-charbon px-2 py-1 text-[8.5px] font-black tracking-wide text-or uppercase">
            ✔ {t("officialBadge")}
          </span>
          {product.tag && (
            <span className="font-display absolute top-2.5 right-2.5 z-10 rotate-3 rounded-md bg-carmin px-2 py-1 text-[9px] tracking-wide text-white">
              {product.tag}
            </span>
          )}
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              width={200}
              height={200}
              className={`max-h-full max-w-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.28)] ${!product.inStock ? "opacity-40 grayscale" : ""}`}
            />
          )}
          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-charbon/50">
              <span className="font-display rotate-[-6deg] rounded-lg border-2 border-white bg-charbon/70 px-4 py-2 text-[15px] tracking-wide text-white uppercase">
                {t("soldOut")}
              </span>
            </div>
          )}
        </div>
        <div className="p-3.5 pb-4">
          <div className="text-[9.5px] font-extrabold tracking-wide text-texte-faible uppercase">{product.categoryLabel}</div>
          <div className="mt-1 min-h-[35px] text-[14px] leading-tight font-extrabold text-blanc-casse">{product.name}</div>
          <div className="mt-3 flex items-center justify-between">
            <div className="font-display text-[22px] text-blanc-casse">{product.price}</div>
            <span
              className="flex items-center gap-1 text-[10.5px] font-extrabold whitespace-nowrap"
              style={{ color: product.inStock ? (product.lowStock ? "#E8945A" : "#5ED99A") : "#8E8E98" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
              {product.inStock ? t("inStock", { count: product.stock }) : t("soldOut")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export async function ShopCategoryFilters({ category }: { category: string }) {
  const t = await getTranslations("shop");
  const cats = [
    { id: "all", label: t("catAll") },
    { id: "display", label: t("catDisplay") },
    { id: "booster", label: t("catBooster") },
    { id: "deck", label: t("catDeck") },
    { id: "merch", label: t("catMerch") },
  ];

  return (
    <div className="flex items-center gap-1.5 rounded-[10px] border border-charbon-500 bg-charbon-800 p-1">
      {cats.map((c) => (
        <Link
          key={c.id}
          href={c.id === "all" ? "/boutique" : `/boutique?cat=${c.id}`}
          className={`font-display rounded-md px-3.5 py-2 text-[11.5px] tracking-wide uppercase transition ${category === c.id ? "bg-or text-charbon" : "text-texte-dim hover:text-blanc-casse"}`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}
