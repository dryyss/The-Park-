import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { DashboardStats } from "@/server/dashboard/dashboard.service";
import { ListingActions } from "@/components/dashboard/listing-actions";
import { AuthGatedLink } from "@/components/auth/auth-gated-link";
import { FEATURES } from "@/lib/features";

export async function DashboardPanel({
  stats,
  readOnly = false,
}: {
  stats: DashboardStats;
  readOnly?: boolean;
}) {
  const t = await getTranslations("dashboard");

  const cards = [
    { label: t("activeListings"), value: stats.activeListings, color: "text-carmin" },
    { label: t("totalViews"), value: stats.totalViews, color: "text-blanc-casse" },
    ...(FEATURES.exchange
      ? [
          { label: t("pendingExchanges"), value: stats.pendingExchanges, color: "text-or" },
          { label: t("completedExchanges"), value: stats.completedExchanges, color: "text-neon-vert" },
        ]
      : []),
    { label: t("activeAuctions"), value: stats.activeAuctions, color: "text-blanc-casse" },
    { label: t("estimatedRevenue"), value: stats.estimatedRevenue, color: "text-or" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
            <p className="text-[11px] font-extrabold tracking-wide text-texte-dim uppercase">{c.label}</p>
            <p className={`mt-2 font-display text-[28px] tracking-wide ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Accès rapide : suivi des ventes et des achats */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/ventes"
          className="font-display -skew-x-3 rounded-[14px] border-[1.5px] border-carmin bg-carmin/10 px-5 py-3.5 text-center text-[13px] tracking-[1.5px] text-carmin uppercase transition hover:bg-carmin hover:text-white"
        >
          📦 {t("mySales")}
        </Link>
        <Link
          href="/marketplace/achats"
          className="font-display -skew-x-3 rounded-[14px] border-[1.5px] border-charbon-400 px-5 py-3.5 text-center text-[13px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin hover:text-carmin"
        >
          🛒 {t("myPurchases")}
        </Link>
      </div>

      <div className="mt-8 rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] tracking-wide text-blanc-casse uppercase">{t("recentListings")}</h2>
          {readOnly ? (
            <AuthGatedLink
              href="/vendre"
              messageKey="loginGateDashboard"
              className="text-[12px] font-extrabold text-carmin hover:underline"
            >
              {t("newListing")}
            </AuthGatedLink>
          ) : (
            <Link href="/vendre" className="text-[12px] font-extrabold text-carmin hover:underline">
              {t("newListing")}
            </Link>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {stats.recentListings.length === 0 ? (
            <p className="text-[13px] font-bold text-texte-dim">{t("noListings")}</p>
          ) : (
            stats.recentListings.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-charbon-700 px-4 py-3">
                <span className="text-[13px] font-extrabold text-blanc-casse">{l.cardName}</span>
                <div className="flex items-center gap-4 text-[12px] font-bold text-texte-dim">
                  <span>{l.price}</span>
                  <span>{l.views} {t("views")}</span>
                  <span className="rounded-md bg-charbon-600 px-2 py-0.5 text-[10px] uppercase">{l.status}</span>
                  {!readOnly && <ListingActions listingId={l.id} status={l.status} />}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
