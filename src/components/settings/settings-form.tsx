"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { saveNotificationPrefsAction } from "@/server/user/settings.actions";
import type { NotificationPrefs } from "@/server/user/settings.service";
import { Link } from "@/i18n/navigation";
import { ProfileIdentityForm } from "@/components/settings/profile-identity-form";
import { AddressBook } from "@/components/settings/address-book";
import type { UserAddress } from "@/server/user/address.service";

export function SettingsForm({
  initialPrefs,
  displayName,
  bio,
  slug,
  addresses,
  securitySection,
}: {
  initialPrefs: NotificationPrefs;
  displayName: string;
  bio: string;
  slug: string;
  addresses: UserAddress[];
  securitySection: ReactNode;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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

  const locales = [
    { code: "fr", label: "FR" },
    { code: "en", label: "EN" },
    { code: "ja", label: "日本語" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <ProfileIdentityForm initialDisplayName={displayName} initialBio={bio} initialSlug={slug} />

      {securitySection}

      <AddressBook addresses={addresses} />

      <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("notifications")}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {toggles.map((tog) => (
            <label key={tog.key} className="flex cursor-pointer items-center justify-between rounded-lg bg-charbon-700 px-4 py-3">
              <span className="text-[13px] font-extrabold text-blanc-casse">{tog.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[tog.key]}
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
      </section>

      <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("language")}</h2>
        <p className="mt-2 text-[13px] font-semibold text-texte-dim">{t("languageDesc")}</p>
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
      </section>

      <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("privacy")}</h2>
        <div className="mt-4 flex flex-col gap-2 text-[13px] font-bold text-texte-dim">
          <p>{t("privacyCollection")}</p>
          <p>{t("privacyProfile")}</p>
          <p>{t("privacyData")}</p>
        </div>
        <button type="button" disabled className="mt-4 rounded-lg border border-charbon-500 px-4 py-2 text-[12px] font-extrabold text-texte-faible uppercase">
          {t("exportSoon")}
        </button>
      </section>
    </div>
  );
}
