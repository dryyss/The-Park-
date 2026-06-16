import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { SupportOverview } from "@/server/admin/support.service";

export async function AdminSupportPanel({ overview }: { overview: SupportOverview }) {
  const t = await getTranslations("admin.support");

  const stats = [
    { key: "activeMembers", value: overview.activeMembers },
    { key: "newMembersWeek", value: overview.newMembersWeek },
    { key: "ordersNeedingHelp", value: overview.ordersNeedingHelp, alert: overview.ordersNeedingHelp > 0 },
    { key: "openReports", value: overview.openReports, alert: overview.openReports > 0 },
  ];

  return (
    <div className="flex flex-col gap-8">
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

      <div className="flex flex-wrap gap-3">
        <Link
          href="/aide"
          className="font-display rounded-[12px] bg-carmin px-5 py-3 text-[13px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
        >
          {t("helpCenter")}
        </Link>
      </div>

      <section className="rounded-[16px] border border-charbon-500 bg-charbon-800">
        <h2 className="border-b border-charbon-500 px-5 py-4 font-display text-[14px] tracking-wide text-blanc-casse uppercase">
          {t("recentMembers")}
        </h2>
        <div className="divide-y divide-charbon-600/50">
          {overview.recentMembers.map((m) => (
            <div key={m.slug} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-extrabold text-blanc-casse">{m.displayName}</p>
                <p className="text-[11px] text-texte-dim">{m.email}</p>
              </div>
              <p className="text-[11px] font-bold text-texte-faible">
                {m.createdAt.toLocaleDateString("fr-FR")}
              </p>
            </div>
          ))}
        </div>
        {overview.recentMembers.length === 0 && (
          <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("noMembers")}</p>
        )}
      </section>

      <p className="text-[12px] font-bold text-texte-faible">{t("contactHint")}</p>
    </div>
  );
}
