import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

export async function SeasonBanner() {
  const t = await getTranslations("home");

  return (
    <div className="animate-fade-up mt-[60px] grid grid-cols-1 overflow-hidden rounded-[20px] border border-charbon-500 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex min-h-[320px] items-center justify-center bg-blanc-casse p-[26px]">
        <Image src="/uploads/BOOSTERS_2.jpg" alt="Boosters Moteur Forgé" width={420} height={330} className="max-h-[330px] w-auto max-w-full object-contain" />
      </div>
      <div className="relative flex flex-col justify-center bg-charbon-800 px-6 py-10 sm:px-11">
        <div className="font-jp pointer-events-none absolute right-[18px] bottom-2.5 text-[64px] font-black text-blanc-casse/4">鍛造エンジン</div>
        <div className="text-[11.5px] font-bold tracking-[4px] text-carmin uppercase">{t("seasonKicker")}</div>
        <h2 className="font-display mt-3 text-[42px] leading-none tracking-[1px] skew-x-[-3deg] uppercase text-blanc-casse">{t("seasonName")}</h2>
        <p className="mt-4 max-w-[440px] text-[14.5px] leading-[1.65] text-texte-corps">
          {t.rich("seasonDesc", { b: (c) => <strong className="text-blanc-casse">{c}</strong> })}
        </p>
        <div className="mt-6">
          <Link
            href="/collection"
            className="font-display inline-block rotate-[-1deg] rounded-[9px] bg-blanc-casse px-5 py-3 text-[13.5px] tracking-[1.5px] text-charbon uppercase shadow-[3px_3px_0_var(--color-carmin)] transition hover:-translate-y-0.5"
          >
            {t("seasonCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
