import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AdminDashboardData } from "@/server/admin/overview.service";
import type { AdminModule } from "@/server/auth/roles.definition";
import type { AdminRole } from "@/generated/prisma/client";

export async function AdminOverviewDashboard({
  data,
  modules,
  staffRole,
}: {
  data: AdminDashboardData;
  modules: AdminModule[];
  staffRole: AdminRole | null;
}) {
  const t = await getTranslations("admin.overview");
  const tRoles = await getTranslations("admin.roles.staffRoles");
  const effectiveRole = staffRole ?? "OWNER";

  return (
    <div className="space-y-10">
      <p className="text-texte-dim text-[13px] font-bold">
        {t("currentRole")}{" "}
        <span className="text-or">{tRoles(effectiveRole)}</span>
      </p>

      {data.actionQueue.length > 0 && (
        <section>
          <h2 className="font-display text-blanc-casse mb-4 text-[16px] tracking-wide uppercase">
            {t("actionQueue")}
          </h2>
          <div className="flex flex-col gap-2">
            {data.actionQueue.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={[
                  "flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3 transition hover:border-carmin",
                  item.involvesMinor
                    ? "border-neon-orange/50 bg-charbon-700"
                    : "border-charbon-500 bg-charbon-800",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold tracking-wide text-carmin uppercase">
                      {t(`actionKinds.${item.kind}`)}
                    </span>
                    {item.involvesMinor && (
                      <span className="rounded bg-neon-orange/20 px-1.5 py-0.5 text-[9px] font-extrabold text-neon-orange uppercase">
                        {t("minorPriority")}
                      </span>
                    )}
                  </div>
                  <p className="text-blanc-casse mt-1 text-[13px] font-extrabold">{item.title}</p>
                  <p className="text-texte-dim mt-0.5 truncate text-[12px]">{item.subtitle}</p>
                </div>
                <span className="text-texte-faible shrink-0 text-[11px] font-bold">
                  {item.createdAt.toISOString().slice(0, 10)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-blanc-casse mb-4 text-[16px] tracking-wide uppercase">
          {t("perspectives")}
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {data.perspectives.map((p) => (
            <div key={p.key} className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display text-[14px] tracking-wide text-blanc-casse uppercase">
                  {t(`perspectiveKeys.${p.key}`)}
                </h3>
                <Link
                  href={p.href}
                  className="text-[11px] font-extrabold text-carmin uppercase hover:underline"
                >
                  {t("openModule")}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.stats.map((s) => (
                  <div
                    key={s.key}
                    className={`rounded-[10px] border p-3 ${s.alert ? "border-neon-orange/40 bg-charbon-700" : "border-charbon-600 bg-charbon-900/50"}`}
                  >
                    <p className="text-texte-dim text-[9px] font-extrabold tracking-wide uppercase">
                      {t(`stats.${s.key}`)}
                    </p>
                    <p className="font-display text-blanc-casse mt-1 text-[22px]">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-blanc-casse mb-4 text-[16px] tracking-wide uppercase">
          {t("quickLinks")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {modules.includes("shop") && (
            <>
              <QuickLink href="/admin/boutique" variant="gold" label={t("links.shop")} />
              <QuickLink href="/admin/commandes" variant="gold-outline" label={t("links.orders")} />
            </>
          )}
          {modules.includes("moderation") && (
            <>
              <QuickLink href="/admin/moderation" variant="orange" label={t("links.moderation")} />
              <QuickLink href="/admin/messages" variant="orange" label={t("links.messages")} />
            </>
          )}
          {modules.includes("marketplace") && (
            <QuickLink href="/admin/marketplace" variant="carmin" label={t("links.marketplace")} />
          )}
          {modules.includes("transactions") && (
            <QuickLink href="/admin/transactions" variant="carmin-outline" label={t("links.transactions")} />
          )}
          {modules.includes("auctions") && (
            <QuickLink href="/admin/encheres" variant="carmin-outline" label={t("links.auctions")} />
          )}
          {modules.includes("finance") && (
            <QuickLink href="/admin/finances" variant="muted" label={t("links.finance")} />
          )}
          {modules.includes("users") && (
            <QuickLink href="/admin/utilisateurs" variant="orange" label={t("links.users")} />
          )}
          {modules.includes("catalog") && (
            <QuickLink href="/admin/catalogue" variant="carmin-outline" label={t("links.catalog")} />
          )}
          {modules.includes("content") && (
            <QuickLink href="/admin/contenu" variant="muted" label={t("links.content")} />
          )}
          {modules.includes("support") && (
            <QuickLink href="/admin/support" variant="muted" label={t("links.support")} />
          )}
          {modules.includes("staff") && (
            <QuickLink href="/admin/roles" variant="carmin" label={t("links.staff")} />
          )}
          {modules.includes("shop") && (
            <QuickLink href="/admin/reglages" variant="muted" label={t("links.settings")} />
          )}
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant: "gold" | "gold-outline" | "carmin" | "carmin-outline" | "orange" | "muted";
}) {
  const styles: Record<typeof variant, string> = {
    gold: "bg-or text-charbon hover:bg-or-clair shadow-[3px_3px_0_rgba(0,0,0,0.35)]",
    "gold-outline": "border-or/40 bg-or/10 text-or hover:bg-or/20 border",
    carmin: "bg-carmin text-white hover:bg-carmin-alt shadow-[2px_2px_0_rgba(0,0,0,0.35)]",
    "carmin-outline": "border-carmin bg-carmin/10 text-carmin hover:bg-carmin hover:text-white border",
    orange: "border-neon-orange/50 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20 border",
    muted: "border-charbon-400 text-texte-doux hover:border-carmin hover:text-white border",
  };

  return (
    <Link
      href={href}
      className={`font-display rounded-[12px] px-5 py-3 text-[12px] tracking-[1px] uppercase transition ${styles[variant]}`}
    >
      {label}
    </Link>
  );
}
