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
      <p className="text-texte-dim mb-6 text-[13px] font-bold">
        {t("roles.currentRole")}{" "}
        <span className="text-or">{t(`roles.staffRoles.${effectiveRole}`)}</span>
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.key}
            className={`rounded-[14px] border p-4 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
          >
            <p className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
              {t(`stats.${s.key}`)}
            </p>
            <p className="font-display text-blanc-casse mt-1 text-[26px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {modules.includes("shop") && (
          <>
            <Link
              href="/admin/boutique"
              className="font-display bg-or text-charbon hover:bg-or-clair rounded-[12px] px-5 py-3 text-[13px] tracking-[1px] uppercase shadow-[3px_3px_0_rgba(0,0,0,0.35)] transition"
            >
              {t("manageShop")}
            </Link>
            <Link
              href="/admin/commandes"
              className="font-display border-or/40 bg-or/10 text-or hover:bg-or/20 rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition"
            >
              {t("manageOrders")}
            </Link>
          </>
        )}
        {modules.includes("staff") && (
          <Link
            href="/admin/roles"
            className="font-display border-carmin bg-carmin/10 text-carmin hover:bg-carmin rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition hover:text-white"
          >
            {t("roles.manage")}
          </Link>
        )}
        {modules.includes("moderation") && (
          <Link
            href="/admin/moderation"
            className="font-display border-neon-orange/50 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20 rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition"
          >
            {t("manageModeration")}
          </Link>
        )}
        {modules.includes("users") && (
          <Link
            href="/admin/utilisateurs"
            className="font-display border-neon-orange/50 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20 rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition"
          >
            {t("manageUsers")}
          </Link>
        )}
        {modules.includes("catalog") && (
          <Link
            href="/admin/catalogue"
            className="font-display border-carmin bg-carmin/10 text-carmin hover:bg-carmin rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition hover:text-white"
          >
            {t("manageCatalog")}
          </Link>
        )}
        {modules.includes("support") && (
          <Link
            href="/admin/support"
            className="font-display border-charbon-400 text-texte-doux hover:border-carmin rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition hover:text-white"
          >
            {t("manageSupport")}
          </Link>
        )}
        {modules.includes("shop") && (
          <Link
            href="/admin/reglages"
            className="font-display border-charbon-400 text-texte-doux hover:border-carmin rounded-[12px] border px-5 py-3 text-[13px] tracking-[1px] uppercase transition hover:text-white"
          >
            {t("manageSettings")}
          </Link>
        )}
      </div>
    </div>
  );
}

export async function AdminShopPanel({
  products,
}: {
  products: import("@/server/admin/admin.service").AdminShopProduct[];
}) {
  const t = await getTranslations("admin");

  return (
    <div className="border-charbon-500 bg-charbon-800 overflow-x-auto rounded-[16px] border">
      <table className="w-full min-w-[600px] text-left text-[13px]">
        <thead>
          <tr className="border-charbon-500 text-texte-dim border-b text-[11px] font-extrabold tracking-wide uppercase">
            <th className="px-4 py-3">{t("shop.sku")}</th>
            <th className="px-4 py-3">{t("shop.name")}</th>
            <th className="px-4 py-3">{t("shop.price")}</th>
            <th className="px-4 py-3">{t("shop.stock")}</th>
            <th className="px-4 py-3">{t("shop.status")}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-charbon-600/50 hover:bg-charbon-700/50 border-b">
              <td className="text-texte-dim px-4 py-3 font-mono text-[12px]">{p.sku}</td>
              <td className="text-blanc-casse px-4 py-3 font-extrabold">{p.name}</td>
              <td className="text-or px-4 py-3">{p.price}</td>
              <td
                className={`px-4 py-3 font-bold ${p.stock <= 5 ? "text-neon-orange" : "text-texte-dim"}`}
              >
                {p.stock}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${p.active ? "bg-neon-vert/15 text-neon-vert" : "bg-charbon-600 text-texte-faible"}`}
                >
                  {p.active ? t("shop.active") : t("shop.inactive")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
