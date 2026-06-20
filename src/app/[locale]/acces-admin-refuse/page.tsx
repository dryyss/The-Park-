import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AdminAccessDeniedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.accessDenied");

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-7 py-16 text-center">
      <p className="text-[12px] font-bold tracking-[4px] text-carmin uppercase">{t("kicker")}</p>
      <h1 className="font-display mt-4 text-[clamp(36px,5vw,52px)] leading-[0.95] tracking-[1px] uppercase text-blanc-casse">
        {t("title")}
      </h1>
      <p className="mt-5 text-[15px] leading-[1.7] text-texte-corps">{t("body")}</p>
      <p className="mt-3 text-[13px] leading-[1.65] text-texte-dim">{t("hint")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="font-display inline-block -skew-x-3 rounded-[10px] bg-carmin px-6 py-3 text-[14px] tracking-[1.5px] text-white uppercase shadow-[3px_3px_0_rgba(0,0,0,0.45)] transition hover:bg-carmin-alt"
        >
          {t("backHome")}
        </Link>
        <Link
          href="/auth/login"
          className="font-display inline-block -skew-x-3 rounded-[10px] border-[1.5px] border-charbon-400 px-6 py-3 text-[14px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin"
        >
          {t("loginOther")}
        </Link>
      </div>
    </main>
  );
}
