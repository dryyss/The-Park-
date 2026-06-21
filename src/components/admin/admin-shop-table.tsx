import { getTranslations } from "next-intl/server";
import type { AdminShopProduct } from "@/server/admin/admin.service";
import { cardImage } from "@/lib/rarity";

export async function AdminShopStats({ products }: { products: AdminShopProduct[] }) {
  const t = await getTranslations("admin.shop.stats");
  const active = products.filter((p) => p.active).length;
  const lowStock = products.filter((p) => p.stock <= 5).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  const stats = [
    { label: t("total"), value: products.length, color: "text-blanc-casse" },
    { label: t("active"), value: active, color: "text-statut-succes" },
    { label: t("lowStock"), value: lowStock, color: "text-statut-alerte" },
    { label: t("outOfStock"), value: outOfStock, color: "text-statut-danger" },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="admin-stat-tile">
          <div className="admin-stat-label">{s.label}</div>
          <div className={`admin-stat-value ${s.color}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export async function AdminShopTable({ products }: { products: AdminShopProduct[] }) {
  const t = await getTranslations("admin.shop.table");

  if (products.length === 0) {
    return <p className="admin-meta py-8 text-center">{t("empty")}</p>;
  }

  return (
    <div className="admin-panel mb-6 overflow-hidden p-0">
      <div className="hidden grid-cols-[2.6fr_1fr_0.9fr_1.1fr_0.9fr] gap-3 border-b border-admin-border px-5 py-3 text-[10px] font-extrabold tracking-wide text-admin-label uppercase md:grid">
        <span>{t("product")}</span>
        <span>{t("category")}</span>
        <span>{t("price")}</span>
        <span>{t("stock")}</span>
        <span>{t("visibility")}</span>
      </div>
      {products.map((p) => {
        const img = p.images[0];
        const stockColor = p.stock === 0 ? "#ff3b5c" : p.stock <= 5 ? "#ff9f43" : "#5ed99a";
        return (
          <a
            key={p.id}
            href={`#product-${p.id}`}
            className="grid grid-cols-1 gap-2 border-b border-admin-border-subtle px-5 py-3 transition hover:bg-[#18181c] md:grid-cols-[2.6fr_1fr_0.9fr_1.1fr_0.9fr] md:items-center md:gap-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] bg-[radial-gradient(circle_at_50%_42%,#fff,#ece6e8_85%)] p-1.5">
                {img ? (
                  <img src={cardImage(img)} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-texte-dim">—</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-extrabold text-blanc-casse">{p.name}</div>
                <div className="text-[10.5px] font-bold text-texte-dim">{p.sku}</div>
              </div>
            </div>
            <div className="text-[12px] font-bold text-texte-corps uppercase md:block">{p.type}</div>
            <div className="font-display text-[15px] text-blanc-casse">{p.price}</div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stockColor }} />
              <span className="text-[12px] font-extrabold" style={{ color: stockColor }}>
                {p.stock}
              </span>
            </div>
            <div>
              <span
                className={[
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                  p.active ? "bg-statut-succes/15 text-statut-succes" : "bg-charbon-600 text-texte-dim",
                ].join(" ")}
              >
                {p.active ? t("visible") : t("hidden")}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
