"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateProfileAction } from "@/server/user/profile.actions";
import { normalizeProfileSlug } from "@/lib/slug";
import { countryOptions } from "@/lib/countries";

const SPOKEN_LANGUAGES = [
  { code: "FR", label: "🇫🇷 Français" },
  { code: "EN", label: "🇬🇧 English" },
  { code: "JP", label: "🇯🇵 日本語" },
  { code: "DE", label: "🇩🇪 Deutsch" },
  { code: "US", label: "🇺🇸 English (US)" },
] as const;

export function ProfileIdentityForm({
  initialDisplayName,
  initialBio,
  initialSlug,
  initialCity = "",
  initialCountry = "",
  initialLanguage = "FR",
}: {
  initialDisplayName: string;
  initialBio: string;
  initialSlug: string;
  initialCity?: string;
  initialCountry?: string;
  initialLanguage?: string;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [slug, setSlug] = useState(initialSlug);
  const [city, setCity] = useState(initialCity);
  const [country, setCountry] = useState(initialCountry);
  const [language, setLanguage] = useState(initialLanguage);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const countries = useMemo(() => countryOptions(locale), [locale]);

  function handleSlugChange(value: string) {
    setSlug(normalizeProfileSlug(value));
  }

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfileAction({ displayName, bio, slug, city, country, language });
      if (!res.ok) {
        if (res.error === "SLUG_TAKEN") setError(t("identitySlugTaken"));
        else if (res.error === "VALIDATION") setError(t("identityValidation"));
        else setError(t("identityError"));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-lg border border-charbon-500 bg-charbon px-3.5 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin";

  return (
    <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("identity")}</h2>
      <p className="mt-1.5 text-[12.5px] font-semibold text-texte-dim">{t("identityDesc")}</p>

      <div className="mt-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("identityDisplayName")}</span>
          <input
            type="text"
            value={displayName}
            maxLength={80}
            disabled={pending}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("identityBio")}</span>
          <textarea
            value={bio}
            maxLength={500}
            rows={3}
            disabled={pending}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t("identityBioPlaceholder")}
            className={`${inputClass} resize-y min-h-[80px]`}
          />
          <span className="text-[10px] font-bold text-texte-faible">{bio.length}/500</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("identityCity")}</span>
          <input
            type="text"
            value={city}
            maxLength={100}
            disabled={pending}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("identityCityPlaceholder")}
            className={inputClass}
          />
          <span className="text-[10px] font-bold text-texte-faible">{t("identityCityHint")}</span>
        </label>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("identityCountry")}</span>
            <select
              value={country}
              disabled={pending}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass}
            >
              <option value="">{t("identityCountryNone")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("identityLanguage")}</span>
            <select
              value={language}
              disabled={pending}
              onChange={(e) => setLanguage(e.target.value)}
              className={inputClass}
            >
              {SPOKEN_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{t("identitySlug")}</span>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[12px] font-bold text-texte-faible">/collectionneur/</span>
            <input
              type="text"
              value={slug}
              maxLength={64}
              disabled={pending}
              onChange={(e) => handleSlugChange(e.target.value)}
              className={inputClass}
            />
          </div>
          <span className="text-[10px] font-bold text-texte-faible">{t("identitySlugHint")}</span>
        </label>

        {error && <p className="text-[12px] font-bold text-neon-rouge">{error}</p>}
        {saved && <p className="text-[12px] font-bold text-statut-succes">{t("identitySaved")}</p>}

        <button
          type="button"
          disabled={pending || !displayName.trim() || !slug.trim()}
          onClick={submit}
          className="font-display self-start -skew-x-3 rounded-lg bg-carmin px-5 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("identitySaving") : t("identitySave")}
        </button>
      </div>
    </section>
  );
}
