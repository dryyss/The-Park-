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
    { key: "flaggedMessages", value: overview.flaggedMessages, alert: overview.flaggedMessages > 0 },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
        <Link href="/aide" className="font-display rounded-[12px] bg-carmin px-5 py-3 text-[13px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt">
          {t("helpCenter")}
        </Link>
        <Link href="/admin/moderation" className="font-display rounded-[12px] border border-neon-orange/50 bg-neon-orange/10 px-5 py-3 text-[13px] tracking-[1px] text-neon-orange uppercase transition hover:bg-neon-orange/20">
          {t("goModeration")}
        </Link>
        <Link href="/admin/messages?flagged=1" className="font-display rounded-[12px] border border-carmin/50 bg-carmin/10 px-5 py-3 text-[13px] tracking-[1px] text-carmin uppercase transition hover:bg-carmin/20">
          {t("goMessages")}
        </Link>
        <Link href="/admin/commandes" className="font-display rounded-[12px] border border-charbon-400 px-5 py-3 text-[13px] tracking-[1px] text-texte-doux uppercase transition hover:border-carmin hover:text-white">
          {t("goOrders")}
        </Link>
      </div>

      <section className="rounded-[16px] border border-charbon-500 bg-charbon-800">
        <h2 className="border-b border-charbon-500 px-5 py-4 font-display text-[14px] tracking-wide text-blanc-casse uppercase">
          {t("recentReports")}
        </h2>
        <div className="divide-y divide-charbon-600/50">
          {overview.recentReports.map((r) => (
            <div key={r.id} className={`flex flex-wrap items-start justify-between gap-3 px-5 py-3 ${r.involvesMinor ? "bg-charbon-700/40" : ""}`}>
              <div>
                <p className="text-[12px] font-extrabold text-blanc-casse">
                  {r.targetType} · {r.reporterName}
                  {r.involvesMinor && <span className="text-neon-orange ml-2 text-[10px] uppercase">{t("minor")}</span>}
                </p>
                <p className="text-texte-dim mt-1 text-[13px]">{r.reason}</p>
              </div>
              <Link href={r.targetType === "MESSAGE" ? "/admin/messages?flagged=1" : "/admin/moderation"} className="text-[11px] font-extrabold text-carmin uppercase hover:underline">
                {t("handle")}
              </Link>
            </div>
          ))}
        </div>
        {overview.recentReports.length === 0 && (
          <p className="p-8 text-center text-[13px] font-bold text-texte-dim">{t("noReports")}</p>
        )}
      </section>

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
              <p className="text-[11px] font-bold text-texte-faible">{m.createdAt.toLocaleDateString("fr-FR")}</p>
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
