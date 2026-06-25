"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { saveNotificationPrefsAction, savePrivacySettingsAction } from "@/server/user/settings.actions";
import type { NotificationPrefs, PrivacySettings } from "@/server/user/settings.service";
import { Link } from "@/i18n/navigation";
import { ProfileIdentityForm } from "@/components/settings/profile-identity-form";
import { AddressBook } from "@/components/settings/address-book";
import { ExportDataButton } from "@/components/settings/export-data-button";
import { SettingsTabLayout } from "@/components/settings/settings-tab-layout";
import type { UserAddress } from "@/server/user/address.service";

export function SettingsForm({
  initialPrefs,
  initialPrivacy,
  displayName,
  bio,
  slug,
  city,
  addresses,
  securitySection,
}: {
  initialPrefs: NotificationPrefs;
  initialPrivacy: PrivacySettings;
  displayName: string;
  bio: string;
  slug: string;
  city: string;
  addresses: UserAddress[];
  securitySection: ReactNode;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);

  const tabs = [
    { key: "profile", label: t("tabs.profile"), jp: "身", iconBg: "rgba(216,27,96,0.12)", iconColor: "#ff2e63" },
    { key: "shipping", label: t("tabs.shipping"), jp: "送", iconBg: "rgba(79,163,255,0.12)", iconColor: "#4fa3ff" },
    { key: "notifications", label: t("tabs.notifications"), jp: "通知", iconBg: "rgba(232,178,58,0.12)", iconColor: "#e8b23a" },
    { key: "security", label: t("tabs.security"), jp: "安", iconBg: "rgba(94,217,154,0.12)", iconColor: "#5ed99a" },
    { key: "privacy", label: t("tabs.privacy"), jp: "私", iconBg: "rgba(176,92,255,0.12)", iconColor: "#b05cff" },
  ];

  const toggles = [
    { key: "exchanges" as const, label: t("notifExchanges") },
    { key: "messages" as const, label: t("notifMessages") },
    { key: "auctions" as const, label: t("notifAuctions") },
    { key: "orders" as const, label: t("notifOrders") },
    { key: "marketing" as const, label: t("notifMarketing") },
  ];

  function persist(next: NotificationPrefs) {
    setSaved(false);
    startTransition(async () => {
      const res = await saveNotificationPrefsAction(next);
      if (res.ok) setSaved(true);
    });
  }

  function toggle(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    persist(next);
  }

  function togglePrivacy(key: keyof PrivacySettings) {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    setPrivacySaved(false);
    startTransition(async () => {
      const res = await savePrivacySettingsAction(next);
      if (res.ok) setPrivacySaved(true);
    });
  }

  const locales = [
    { code: "fr", label: "FR" },
    { code: "en", label: "EN" },
    { code: "ja", label: "日本語" },
  ] as const;

  const panelCls = "rounded-2xl border border-charbon-500 bg-charbon-800 p-6";

  return (
    <SettingsTabLayout tabs={tabs} defaultTab="profile">
      {(active) => (
        <>
          {active === "profile" && (
            <div className={panelCls}>
              <h2 className="font-display mb-4 text-[18px] -skew-x-3 tracking-wide uppercase">{t("identity")}</h2>
              <ProfileIdentityForm initialDisplayName={displayName} initialBio={bio} initialSlug={slug} initialCity={city} />
            </div>
          )}
          {active === "shipping" && (
            <div className={panelCls}>
              <h2 className="font-display mb-4 text-[18px] -skew-x-3 tracking-wide uppercase">{t("addresses")}</h2>
              <AddressBook addresses={addresses} />
            </div>
          )}
          {active === "notifications" && (
            <div className={panelCls}>
              <h2 className="font-display mb-4 text-[18px] -skew-x-3 tracking-wide uppercase">{t("notifications")}</h2>
              <div className="flex flex-col gap-3">
                {toggles.map((tog) => (
                  <label key={tog.key} className="flex cursor-pointer items-center justify-between rounded-lg bg-charbon-700 px-4 py-3">
                    <span className="text-[13px] font-extrabold text-blanc-casse">{tog.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs[tog.key]}
                      aria-label={tog.label}
                      disabled={pending}
                      onClick={() => toggle(tog.key)}
                      className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${prefs[tog.key] ? "bg-carmin" : "bg-charbon-500"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${prefs[tog.key] ? "left-5.5" : "left-0.5"}`} />
                    </button>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-bold text-texte-faible">{saved ? t("notifSaved") : t("notifHint")}</p>
            </div>
          )}
          {active === "security" && <div className={panelCls}>{securitySection}</div>}
          {active === "privacy" && (
            <div className="flex flex-col gap-4">
              <div className={panelCls}>
                <h2 className="font-display mb-4 text-[18px] -skew-x-3 tracking-wide uppercase">{t("language")}</h2>
                <p className="text-[13px] font-semibold text-texte-dim">{t("languageDesc")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {locales.map((loc) => (
                    <Link
                      key={loc.code}
                      href="/parametres"
                      locale={loc.code}
                      className={`rounded-lg border px-4 py-2 text-[12px] font-extrabold ${
                        locale === loc.code ? "border-carmin bg-carmin/10 text-carmin" : "border-charbon-500 text-texte-dim hover:border-carmin"
                      }`}
                    >
                      {loc.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className={panelCls}>
                <h2 className="font-display mb-4 text-[18px] -skew-x-3 tracking-wide uppercase">{t("privacy")}</h2>
                <div className="flex flex-col gap-3">
                  {([
                    { key: "allowFriendRequests" as const, label: t("privacyAllowFriendRequests"), desc: t("privacyAllowFriendRequestsDesc") },
                    { key: "allowMessages" as const, label: t("privacyAllowMessages"), desc: t("privacyAllowMessagesDesc") },
                  ]).map((tog) => (
                    <label key={tog.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-lg bg-charbon-700 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-extrabold text-blanc-casse">{tog.label}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-texte-dim">{tog.desc}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={privacy[tog.key]}
                        aria-label={tog.label}
                        disabled={pending}
                        onClick={() => togglePrivacy(tog.key)}
                        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${privacy[tog.key] ? "bg-carmin" : "bg-charbon-500"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${privacy[tog.key] ? "left-5.5" : "left-0.5"}`} />
                      </button>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-[11px] font-bold text-texte-faible">{privacySaved ? t("notifSaved") : ""}</p>
                <ExportDataButton />
              </div>
            </div>
          )}
        </>
      )}
    </SettingsTabLayout>
  );
}
