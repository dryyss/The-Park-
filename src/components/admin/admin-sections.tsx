import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AdminOverview } from "@/server/admin/admin.service";
import type { AdminModule } from "@/server/auth/roles.definition";
import type { AdminRole } from "@/generated/prisma/client";

export async function AdminOverviewPanel({
  overview,
  modules,
  staffRole,
}: {
  overview: AdminOverview;
  modules: AdminModule[];
  staffRole: AdminRole | null;
}) {
  const t = await getTranslations("admin");
  const effectiveRole = staffRole ?? "OWNER";

  const stats = [
    { key: "members", value: overview.members },
    { key: "activeListings", value: overview.activeListings },
    { key: "openDisputes", value: overview.openDisputes, alert: overview.openDisputes > 0 },
    { key: "pendingReports", value: overview.pendingReports, alert: overview.pendingReports > 0 },
    { key: "shopProducts", value: overview.shopProducts },
    { key: "lowStock", value: overview.lowStockProducts, alert: overview.lowStockProducts > 0 },
    { key: "ordersPending", value: overview.ordersPending },
    { key: "activeAuctions", value: overview.activeAuctions },
  ];

  return (
    <div>
      <p className="mb-6 text-[13px] font-bold text-texte-dim">
        {t("roles.currentRole")}{" "}
        <span className="text-or">{t(`roles.staffRoles.${effectiveRole}`)}</span>
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.key}
            className={`rounded-[14px] border p-4 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
          >
            <p className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t(`stats.${s.key}`)}</p>
            <p className="mt-1 font-display text-[26px] text-blanc-casse">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {modules.includes("shop") && (
          <>
            <Link
              href="/admin/boutique"
              className="font-display rounded-[12px] bg-or px-5 py-3 text-[13px] tracking-[1px] text-charbon uppercase shadow-[3px_3px_0_rgba(0,0,0,0.35)] transition hover:bg-or-clair"
            >
              {t("manageShop")}
            </Link>
            <Link
              href="/admin/commandes"
              className="font-display rounded-[12px] border border-or/40 bg-or/10 px-5 py-3 text-[13px] tracking-[1px] text-or uppercase transition hover:bg-or/20"
            >
              {t("manageOrders")}
            </Link>
          </>
        )}
        {modules.includes("staff") && (
          <Link
            href="/admin/roles"
            className="font-display rounded-[12px] border border-carmin bg-carmin/10 px-5 py-3 text-[13px] tracking-[1px] text-carmin uppercase transition hover:bg-carmin hover:text-white"
          >
            {t("roles.manage")}
          </Link>
        )}
        {modules.includes("moderation") && (
          <Link
            href="/admin/moderation"
            className="font-display rounded-[12px] border border-neon-orange/50 bg-neon-orange/10 px-5 py-3 text-[13px] tracking-[1px] text-neon-orange uppercase transition hover:bg-neon-orange/20"
          >
            {t("manageModeration")}
          </Link>
        )}
        {modules.includes("catalog") && (
          <Link
            href="/admin/catalogue"
            className="font-display rounded-[12px] border border-carmin bg-carmin/10 px-5 py-3 text-[13px] tracking-[1px] text-carmin uppercase transition hover:bg-carmin hover:text-white"
          >
            {t("manageCatalog")}
          </Link>
        )}
        {modules.includes("shop") && (
          <Link
            href="/admin/reglages"
            className="font-display rounded-[12px] border border-charbon-400 px-5 py-3 text-[13px] tracking-[1px] text-texte-doux uppercase transition hover:border-carmin hover:text-white"
          >
            {t("manageSettings")}
          </Link>
        )}
      </div>
    </div>
  );
}

export async function AdminShopPanel({ products }: { products: import("@/server/admin/admin.service").AdminShopProduct[] }) {
  const t = await getTranslations("admin");

  return (
    <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
      <table className="w-full min-w-[600px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
            <th className="px-4 py-3">{t("shop.sku")}</th>
            <th className="px-4 py-3">{t("shop.name")}</th>
            <th className="px-4 py-3">{t("shop.price")}</th>
            <th className="px-4 py-3">{t("shop.stock")}</th>
            <th className="px-4 py-3">{t("shop.status")}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-charbon-600/50 hover:bg-charbon-700/50">
              <td className="px-4 py-3 font-mono text-[12px] text-texte-dim">{p.sku}</td>
              <td className="px-4 py-3 font-extrabold text-blanc-casse">{p.name}</td>
              <td className="px-4 py-3 text-or">{p.price}</td>
              <td className={`px-4 py-3 font-bold ${p.stock <= 5 ? "text-neon-orange" : "text-texte-dim"}`}>{p.stock}</td>
              <td className="px-4 py-3">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${p.active ? "bg-neon-vert/15 text-neon-vert" : "bg-charbon-600 text-texte-faible"}`}>
                  {p.active ? t("shop.active") : t("shop.inactive")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-4 text-center text-[11px] font-bold text-texte-faible">{t("shop.editSoon")}</p>
    </div>
  );
}
