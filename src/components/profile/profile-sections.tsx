import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import { formatPercent } from "@/lib/format";
import { LogoutLink } from "@/components/auth/logout-link";
import type { ViewerProfile } from "@/server/profile/profile.service";

export async function ProfileHeader({ profile }: { profile: ViewerProfile }) {
  const t = await getTranslations("profile");
  const tAuth = await getTranslations("auth");
  const tStaff = profile.staffRole ? await getTranslations("admin.roles.staffRoles") : null;

  const memberSince = new Intl.DateTimeFormat("fr-FR", { month: "2-digit", year: "numeric" }).format(profile.memberSince);
  const badgeLabel = profile.staffRole && tStaff ? tStaff(profile.staffRole).toUpperCase() : t("badgeCollector");
  const badgeClass = profile.staffRole
    ? "border-[rgba(232,178,58,0.45)] bg-[rgba(232,178,58,0.12)] text-or"
    : "border-[rgba(79,163,255,0.4)] bg-[rgba(79,163,255,0.1)] text-[#4FA3FF]";

  return (
    <div className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-[20px] border border-charbon-500 bg-charbon-800 p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_0%,rgba(216,27,96,0.2),transparent_55%)]" />
      <div
        className="font-display relative flex h-24 w-24 -rotate-3 items-center justify-center rounded-[22px] text-[42px] text-white shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
        style={{ background: avatarGradient(profile.initial) }}
      >
        {profile.initial}
      </div>
      <div className="relative min-w-[260px] flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[38px] leading-none -skew-x-3 uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
            {profile.displayName}
          </h1>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-extrabold tracking-wide ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-4 text-[12.5px] font-bold text-texte-dim">
          <span className="text-or">
            ★ {profile.rating} <span className="text-texte-faible">({t("reviews", { count: profile.reviews })})</span>
          </span>
          <span>{t("exchangesCount", { count: profile.exchangeCount })}</span>
          <span>{t("listingsCount", { count: profile.listingCount })}</span>
          <span>{t("memberSince", { date: memberSince })}</span>
        </div>
      </div>
      <div className="relative flex flex-col items-end gap-3">
        <div className="text-right">
          <div className="font-display text-[52px] leading-none text-blanc-casse">
            {profile.pct}
            <span className="text-[24px] text-carmin">%</span>
          </div>
          <div className="mt-1 text-[12px] font-bold text-texte-dim">
            {t("ownedSummary", { owned: profile.owned, total: profile.total })}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/parametres"
            className="font-display -skew-x-3 rounded-[10px] border border-charbon-500 bg-charbon-700 px-4 py-2.5 text-[12px] tracking-[1px] text-blanc-casse uppercase transition hover:border-carmin"
          >
            {t("linkSettings")}
          </Link>
          <LogoutLink label={tAuth("logout")} variant="profile" />
        </div>
      </div>
    </div>
  );
}

export async function ProfileSidebar({ profile }: { profile: ViewerProfile }) {
  const t = await getTranslations("profile");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-2xl border border-charbon-500 bg-charbon-800 p-5">
        <div className="text-[10.5px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("estimatedValue")}</div>
        <div className="font-display mt-1.5 text-[34px] text-blanc-casse">{profile.estimatedValue}</div>
        <div className="mt-0.5 text-[11.5px] font-bold text-neon-vert">{t("valueHint")}</div>
      </div>
      <div className="rounded-2xl border border-charbon-500 bg-charbon-800 p-5">
        <div className="mb-3.5 flex items-center gap-2.5">
          <h2 className="font-display text-[18px] tracking-[2px] -skew-x-3 uppercase text-blanc-casse">{t("completion")}</h2>
          <span className="font-jp text-[11px] font-bold tracking-[2px] text-texte-faible">完成度</span>
        </div>
        <div className="flex flex-col gap-3">
          {profile.rarityBars.map((b) => (
            <div key={b.code}>
              <div className="mb-1 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span style={{ color: b.color }} className="text-[12px]">
                    {b.glyph}
                  </span>
                  <span className="text-[11px] font-extrabold tracking-[1.5px] text-texte-doux uppercase">{b.label}</span>
                </div>
                <span className="text-[11px] font-bold text-texte-dim">
                  {b.owned}/{b.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-charbon-600">
                <div className="h-full rounded transition-all" style={{ width: `${b.pct}%`, background: b.color }} />
              </div>
            </div>
          ))}
        </div>
        <Link href="/collection" className="font-display mt-4 inline-block text-[12px] tracking-[1.5px] text-carmin uppercase">
          {t("viewCollection")} →
        </Link>
      </div>
    </div>
  );
}

export async function ProfileBadges({ profile }: { profile: ViewerProfile }) {
  const t = await getTranslations("profile");
  const unlocked = profile.badges.filter((b) => b.unlocked).length;

  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="font-display text-[22px] tracking-[2px] -skew-x-3 uppercase text-blanc-casse [text-shadow:2px_2px_0_var(--color-carmin)]">
          {t("badges")}
        </h2>
        <span className="font-jp text-[12px] font-bold tracking-[2px] text-texte-faible">バッジ</span>
        <span className="rounded-full border border-charbon-500 bg-charbon-800 px-2.5 py-1 text-[12px] font-extrabold text-carmin">
          {unlocked} / {profile.badges.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profile.badges.map((bd) => (
          <div
            key={bd.code}
            title={bd.description}
            className={`flex items-center gap-3 rounded-[14px] border bg-charbon-800 p-3.5 ${bd.unlocked ? "border-charbon-500 opacity-100" : "border-charbon-600 opacity-45"}`}
          >
            <div
              className="font-jp flex h-[42px] w-[42px] shrink-0 -rotate-3 items-center justify-center rounded-[11px] text-[19px] font-black"
              style={{
                background: bd.unlocked ? "rgba(216,27,96,0.15)" : "#26262B",
                color: bd.unlocked ? "#D81B60" : "#5A5A64",
              }}
            >
              {bd.icon}
            </div>
            <div className="min-w-0">
              <div className={`text-[12.5px] font-extrabold ${bd.unlocked ? "text-blanc-casse" : "text-texte-faible"}`}>{bd.name}</div>
              <div className="mt-0.5 text-[10.5px] leading-snug font-semibold text-texte-faible">{bd.description}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export async function ProfileReviews({ profile }: { profile: ViewerProfile }) {
  const t = await getTranslations("profile");
  if (profile.recentReviews.length === 0) return null;

  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="font-display text-[22px] tracking-[2px] -skew-x-3 uppercase text-blanc-casse [text-shadow:2px_2px_0_var(--color-carmin)]">
          {t("reputation")}
        </h2>
        <span className="font-jp text-[12px] font-bold tracking-[2px] text-texte-faible">評判</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {profile.recentReviews.map((rv) => (
          <div key={rv.id} className="rounded-[14px] border border-charbon-500 bg-charbon-800 p-4">
            <div className="flex items-center gap-2">
              <span
                className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] text-white"
                style={{ background: avatarGradient(rv.authorInitial) }}
              >
                {rv.authorInitial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-extrabold text-texte-doux">{rv.authorName}</div>
                <div className="text-[10px] font-bold text-texte-faible">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(rv.createdAt)}
                </div>
              </div>
              <span className="text-or text-[12px] font-extrabold">{"★".repeat(rv.rating)}</span>
            </div>
            {rv.comment && <p className="mt-2.5 text-[12px] leading-relaxed text-texte-dim">{rv.comment}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export async function ProfileQuickLinks({ profile }: { profile: ViewerProfile }) {
  const t = await getTranslations("profile");

  const links = [
    { href: "/parametres", label: t("linkSettings"), pct: "⚙" },
    { href: "/collection", label: t("linkCollection"), pct: formatPercent(profile.pct / 100) },
    { href: "/echanges", label: t("linkExchanges"), pct: String(profile.exchangeCount) },
    { href: "/vendre", label: t("linkSell"), pct: String(profile.listingCount) },
    { href: `/collectionneur/${profile.slug}`, label: t("linkPublic"), pct: "→" },
  ];

  if (profile.staffDashboardHref) {
    links.unshift({ href: profile.staffDashboardHref, label: t("linkStaffDashboard"), pct: "✔" });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-xl border border-charbon-500 bg-charbon-800 p-4 transition hover:border-carmin"
        >
          <div className="font-display text-[13px] tracking-[1px] text-blanc-casse uppercase">{l.label}</div>
          <div className="mt-1 text-[20px] font-extrabold text-carmin">{l.pct}</div>
        </Link>
      ))}
    </div>
  );
}
