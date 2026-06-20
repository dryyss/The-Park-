"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminStockProduct, AdminStockMovementRow, AdminStockStats } from "@/server/admin/stocks.service";
import { adjustStockAction } from "@/server/admin/stocks.actions";

const STATUS_CLASSES: Record<string, string> = {
  IN_STOCK: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
  LOW: "bg-neon-orange/10 text-neon-orange border-neon-orange/30",
  OUT: "bg-carmin/10 text-carmin border-carmin/30",
  DISCONTINUED: "bg-charbon-600/40 text-texte-dim border-charbon-500",
};

const MOVEMENT_TYPE_CLASSES: Record<string, string> = {
  RESTOCK: "text-emerald-400",
  SALE: "text-carmin",
  RETURN: "text-blue-400",
  ADJUSTMENT: "text-or",
  LOSS: "text-neon-orange",
};

type Tab = "products" | "movements";

export function AdminStocksPanel({
  products,
  movements,
  stats,
  tab,
}: {
  products: AdminStockProduct[];
  movements: AdminStockMovementRow[];
  stats: AdminStockStats;
  tab: Tab;
}) {
  const t = useTranslations("admin.stocks");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(tab);
  const [adjustProductId, setAdjustProductId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustType, setAdjustType] = useState<string>("RESTOCK");
  const [adjustReason, setAdjustReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function switchTab(next: Tab) {
    setActiveTab(next);
    router.push(`/admin/stocks?tab=${next}`);
  }

  function openAdjust(productId: string) {
    setAdjustProductId(productId);
    setAdjustDelta("");
    setAdjustType("RESTOCK");
    setAdjustReason("");
    setError(null);
    setSuccess(null);
  }

  function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustProductId) return;
    setError(null);
    setSuccess(null);

    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) {
      setError(t("adjust.errorDelta"));
      return;
    }

    startTransition(async () => {
      const res = await adjustStockAction({
        productId: adjustProductId,
        type: adjustType,
        delta: adjustType === "SALE" || adjustType === "LOSS" ? -Math.abs(delta) : Math.abs(delta),
        reason: adjustReason || undefined,
      });
      if (res.ok) {
        setSuccess(t("adjust.success"));
        setAdjustProductId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "products", label: t("tabs.products") },
    { key: "movements", label: t("tabs.movements") },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { key: "totalProducts", value: stats.totalProducts },
          { key: "inStock", value: stats.inStock },
          { key: "low", value: stats.low, alert: stats.low > 0 },
          { key: "out", value: stats.out, alert: stats.out > 0 },
          { key: "discontinued", value: stats.discontinued },
        ].map((s) => (
          <div
            key={s.key}
            className={`rounded-[12px] border p-3 ${s.alert ? "border-neon-orange/50 bg-charbon-700" : "border-charbon-500 bg-charbon-800"}`}
          >
            <p className="text-[9px] font-extrabold tracking-wide text-texte-dim uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display mt-1 text-[20px] text-blanc-casse">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[10px] border border-charbon-500 bg-charbon-800 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`rounded-[8px] px-4 py-1.5 text-[12px] font-extrabold transition-colors ${
              activeTab === tab.key
                ? "bg-carmin text-blanc-casse"
                : "text-texte-dim hover:text-blanc-casse"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Modal ajustement */}
      {adjustProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charbon/80 backdrop-blur-sm">
          <form
            onSubmit={submitAdjust}
            className="w-full max-w-md rounded-[16px] border border-charbon-500 bg-charbon-800 p-6 shadow-xl"
          >
            <h2 className="mb-4 text-[15px] font-extrabold text-blanc-casse">{t("adjust.title")}</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-texte-dim uppercase">{t("adjust.type")}</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full rounded-[8px] border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
                >
                  {["RESTOCK", "RETURN", "ADJUSTMENT", "SALE", "LOSS"].map((type) => (
                    <option key={type} value={type}>{t(`movementType.${type}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-texte-dim uppercase">{t("adjust.quantity")}</label>
                <input
                  type="number"
                  min={1}
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="ex: 10"
                  className="w-full rounded-[8px] border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
                  required
                />
                <p className="mt-1 text-[11px] text-texte-dim">{t("adjust.quantityHint")}</p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-texte-dim uppercase">{t("adjust.reason")}</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t("adjust.reasonPlaceholder")}
                  maxLength={200}
                  className="w-full rounded-[8px] border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-[12px] font-bold text-carmin">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setAdjustProductId(null)}
                className="flex-1 rounded-[8px] border border-charbon-500 px-4 py-2 text-[12px] font-bold text-texte-dim hover:text-blanc-casse"
              >
                {t("adjust.cancel")}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-[8px] bg-or px-4 py-2 text-[12px] font-extrabold text-charbon uppercase disabled:opacity-50"
              >
                {pending ? t("adjust.saving") : t("adjust.save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {success && (
        <p className="text-center text-[13px] font-bold text-emerald-400">{success}</p>
      )}

      {/* Tab: Produits */}
      {activeTab === "products" && (
        <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
          <table className="w-full min-w-[780px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
                <th className="px-4 py-3">{t("table.sku")}</th>
                <th className="px-4 py-3">{t("table.name")}</th>
                <th className="px-4 py-3">{t("table.type")}</th>
                <th className="px-4 py-3 text-right">{t("table.stock")}</th>
                <th className="px-4 py-3">{t("table.status")}</th>
                <th className="px-4 py-3">{t("table.price")}</th>
                <th className="px-4 py-3">{t("table.lastMovement")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-charbon-600/50 hover:bg-charbon-700/30">
                  <td className="px-4 py-3 font-mono text-[11px] text-texte-dim">{p.sku}</td>
                  <td className="px-4 py-3 font-bold text-blanc-casse">{p.name}</td>
                  <td className="px-4 py-3 text-[11px] text-texte-dim">{p.type}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-blanc-casse">{p.stock}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_CLASSES[p.status] ?? ""}`}>
                      {t(`status.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-or">{p.price}</td>
                  <td className="px-4 py-3 text-[11px] text-texte-dim">
                    {p.lastMovement
                      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(p.lastMovement)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openAdjust(p.id)}
                      className="rounded-[6px] border border-charbon-400 px-3 py-1 text-[11px] font-bold text-blanc-casse hover:border-or hover:text-or"
                    >
                      {t("table.adjust")}
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-texte-dim">{t("table.empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Mouvements */}
      {activeTab === "movements" && (
        <div className="overflow-x-auto rounded-[16px] border border-charbon-500 bg-charbon-800">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-charbon-500 text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">
                <th className="px-4 py-3">{t("movements.date")}</th>
                <th className="px-4 py-3">{t("movements.product")}</th>
                <th className="px-4 py-3">{t("movements.type")}</th>
                <th className="px-4 py-3 text-right">{t("movements.quantity")}</th>
                <th className="px-4 py-3 text-right">{t("movements.before")}</th>
                <th className="px-4 py-3 text-right">{t("movements.after")}</th>
                <th className="px-4 py-3">{t("movements.reason")}</th>
                <th className="px-4 py-3">{t("movements.by")}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-charbon-600/50 hover:bg-charbon-700/30">
                  <td className="px-4 py-3 text-[11px] text-texte-dim whitespace-nowrap">
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(m.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-blanc-casse">{m.productName}</span>
                    <span className="ml-2 font-mono text-[10px] text-texte-dim">{m.productSku}</span>
                  </td>
                  <td className={`px-4 py-3 text-[11px] font-extrabold uppercase ${MOVEMENT_TYPE_CLASSES[m.type] ?? "text-texte-dim"}`}>
                    {t(`movementType.${m.type}`)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${m.quantity > 0 ? "text-emerald-400" : "text-carmin"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-texte-dim">{m.stockBefore}</td>
                  <td className="px-4 py-3 text-right font-mono text-blanc-casse">{m.stockAfter}</td>
                  <td className="px-4 py-3 text-[12px] text-texte-dim">{m.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-[11px] text-texte-dim">{m.performedBy ?? "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-texte-dim">{t("movements.empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
