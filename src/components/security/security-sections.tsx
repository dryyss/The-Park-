import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SecurityContextBanner({
  exchange,
}: {
  exchange: {
    id: string;
    shortId: string;
    status: string;
    secured: boolean;
    partnerName: string;
    itemCount: number;
  } | null;
}) {
  const t = await getTranslations("security");

  if (!exchange) {
    return (
      <div className="rounded-[14px] border border-charbon-500 bg-charbon-800 p-4 text-[13px] font-bold text-texte-dim">
        {t("noExchange")}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-carmin/30 bg-charbon-700 p-4">
      <p className="text-[11px] font-extrabold tracking-[2px] text-carmin uppercase">{t("demoContext")}</p>
      <p className="mt-1 text-[14px] font-extrabold text-blanc-casse">
        {t("exchangeRef", { id: exchange.shortId, partner: exchange.partnerName })}
      </p>
      <p className="mt-1 text-[12px] font-bold text-texte-dim">
        {t("itemCount", { count: exchange.itemCount })} · {exchange.secured ? t("securedOn") : t("securedOff")}
      </p>
      <Link href={`/echanges?id=${exchange.id}`} className="mt-2 inline-block text-[12px] font-extrabold text-carmin hover:underline">
        {t("viewExchange")}
      </Link>
    </div>
  );
}

export async function SecurityStepList({ currentStep }: { currentStep: string }) {
  const t = await getTranslations("security");
  const steps = ["garantie", "option-envoi", "envoi", "deballage", "echange", "etats", "litige"] as const;

  return (
    <nav className="flex flex-wrap gap-2">
      {steps.map((s) => (
        <Link
          key={s}
          href={`/securite/${s}`}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase transition ${currentStep === s ? "bg-carmin text-white" : "bg-charbon-700 text-texte-dim hover:text-blanc-casse"}`}
        >
          {t(`steps.${s}`)}
        </Link>
      ))}
    </nav>
  );
}
