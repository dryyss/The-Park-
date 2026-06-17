import { getTranslations } from "next-intl/server";

export async function AccountSecuritySection({
  email,
  passwordResetUrl,
}: {
  email: string;
  passwordResetUrl: string | null;
}) {
  const t = await getTranslations("settings");
  const tAuth = await getTranslations("auth");

  return (
    <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("security")}</h2>
      <p className="mt-1.5 text-[12.5px] font-semibold text-texte-dim">{t("securityDesc")}</p>

      <div className="mt-4 flex flex-col gap-3">
        <div className="rounded-lg bg-charbon-700 px-4 py-3">
          <div className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("securityEmail")}</div>
          <div className="mt-1 text-[14px] font-extrabold text-blanc-casse">{email}</div>
          <p className="mt-1.5 text-[11px] font-bold text-texte-faible">{t("securityEmailHint")}</p>
        </div>

        {passwordResetUrl ? (
          <a
            href={passwordResetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display self-start -skew-x-3 rounded-lg border border-charbon-400 px-5 py-2.5 text-[12px] tracking-[1px] text-blanc-casse uppercase transition hover:border-carmin hover:text-carmin"
          >
            {t("securityPasswordCta")} →
          </a>
        ) : (
          <p className="text-[12px] font-bold text-texte-faible">{t("securityPasswordUnavailable")}</p>
        )}

        <a
          href="/auth/logout"
          className="font-display self-start -skew-x-3 rounded-lg border border-charbon-400 px-5 py-2.5 text-[12px] tracking-[1px] text-neon-rouge uppercase transition hover:border-neon-rouge hover:bg-neon-rouge/10"
        >
          {tAuth("logout")}
        </a>
      </div>
    </section>
  );
}
