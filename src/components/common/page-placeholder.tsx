import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Page de section déjà câblée dans la navigation mais dont le contenu sera
 * implémenté (même patron : service + composants + page dynamique).
 */
export async function PagePlaceholder({ title, jp }: { title: string; jp: string }) {
  const t = await getTranslations("pages");

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[1320px] flex-col items-center justify-center px-7 py-24 text-center">
      <div className="font-jp text-[64px] leading-none font-black text-blanc-casse/5 select-none">{jp}</div>
      <h1 className="font-display mt-2 text-[clamp(40px,6vw,68px)] leading-[0.95] -skew-x-6 uppercase text-blanc-casse [text-shadow:4px_4px_0_var(--color-carmin)]">
        {title}
      </h1>
      <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-texte-corps">{t("soon")}</p>
      <Link
        href="/"
        className="font-display mt-7 inline-block -skew-x-3 rounded-[10px] bg-carmin px-6 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition hover:bg-carmin-alt"
      >
        {t("backHome")}
      </Link>
    </main>
  );
}
