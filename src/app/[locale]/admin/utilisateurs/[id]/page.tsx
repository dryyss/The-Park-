import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { getUserDetail } from "@/server/admin/users.service";
import { AdminUserActions } from "@/components/admin/admin-user-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-neon-vert/15 text-neon-vert",
  PENDING_VERIFICATION: "bg-charbon-600 text-texte-dim",
  SUSPENDED: "bg-neon-orange/15 text-neon-orange",
  BANNED: "bg-neon-rouge/15 text-neon-rouge",
  DELETED: "bg-charbon-600 text-texte-faible",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.users");

  const access = await requireModule("users");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/utilisateurs/${id}`)}`);
    notFound();
  }

  const user = await getUserDetail(id);
  if (!user) notFound();

  const isStaff = user.staffRole != null;
  const counts: { key: string; value: number }[] = [
    { key: "countListings", value: user.counts.listings },
    { key: "countSales", value: user.counts.sales },
    { key: "countExchanges", value: user.counts.exchanges },
    { key: "countDisputes", value: user.counts.disputes },
    { key: "countReports", value: user.counts.reportsMade },
  ];

  return (
    <main className="mx-auto max-w-[1100px] px-7 pt-9 pb-[60px]">
      <Link href="/admin/utilisateurs" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("backToList")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[22px] tracking-wide text-blanc-casse">{user.displayName}</h1>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_STYLE[user.status] ?? "bg-charbon-600 text-texte-dim"}`}>
              {t(`status_${user.status}`)}
            </span>
            {isStaff && <span className="rounded-md bg-or/15 px-2 py-0.5 text-[10px] font-extrabold text-or uppercase">{user.staffRole}</span>}
          </div>
          <p className="mt-1 text-[12.5px] font-bold text-texte-dim">{user.email} · @{user.slug}</p>
          <p className="mt-0.5 text-[11.5px] text-texte-faible">
            {t("memberSince", { date: user.createdAt.toISOString().slice(0, 10) })}
            {user.lastLoginAt && ` · ${t("lastLogin", { date: user.lastLoginAt.toISOString().slice(0, 10) })}`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counts.map((c) => (
          <div key={c.key} className="rounded-[14px] border border-charbon-500 bg-charbon-800 p-4 text-center">
            <p className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t(c.key)}</p>
            <p className="font-display mt-1 text-[24px] text-blanc-casse">{c.value}</p>
          </div>
        ))}
      </div>

      {!isStaff && (
        <div className="mt-4">
          <AdminUserActions userId={user.id} status={user.status} />
        </div>
      )}
      {isStaff && (
        <p className="mt-4 rounded-[14px] border border-or/30 bg-or/5 px-4 py-3 text-[12.5px] font-bold text-or">{t("staffProtected")}</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[15px] tracking-wide text-blanc-casse uppercase">{t("reportsReceived")}</h2>
          {user.reportsReceived.length === 0 ? (
            <p className="mt-3 text-[12.5px] font-bold text-texte-faible">{t("none")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {user.reportsReceived.map((r) => (
                <li key={r.id} className="rounded-lg border border-charbon-600 bg-charbon-700/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-blanc-casse">{r.reason}</span>
                    <span className="text-[10px] font-extrabold text-texte-dim uppercase">{r.status}</span>
                  </div>
                  <span className="text-[10.5px] text-texte-faible">
                    {r.reporterName} · {r.createdAt.toISOString().slice(0, 10)}
                    {r.involvesMinor && <span className="ml-1 text-neon-rouge">· {t("minor")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[15px] tracking-wide text-blanc-casse uppercase">{t("moderationHistory")}</h2>
          {user.moderationHistory.length === 0 ? (
            <p className="mt-3 text-[12.5px] font-bold text-texte-faible">{t("none")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {user.moderationHistory.map((m) => (
                <li key={m.id} className="rounded-lg border border-charbon-600 bg-charbon-700/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11.5px] font-bold text-or">{m.action}</span>
                    <span className="text-[10.5px] text-texte-faible">{m.createdAt.toISOString().slice(0, 10)}</span>
                  </div>
                  <span className="text-[10.5px] text-texte-faible">{m.moderatorName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
